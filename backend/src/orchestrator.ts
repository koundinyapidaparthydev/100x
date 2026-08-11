/**
 * AI job orchestrator (docs/ai/AI_DELEGATION.md, docs/SCHEMA_SKETCH.md hard rules).
 *
 * State machine:
 *   queued → sanitizing → enriching_mcp → (blocked_pii | running) → packaging → attaching → ready_for_human
 *
 * `enriching_mcp` runs when the tenant has connected MCP providers; otherwise it is a no-op hop.
 *
 * Hard rules:
 *  - a job NEVER enters 'running' unless sanitizing succeeded
 *  - EVERY state transition emits an AuditEvent
 *  - model receives ONLY sanitized text via ModelRunner
 *  - board write-back goes through BoardConnector
 *  - token estimate is checked against policy.tokenBudget BEFORE the model runs
 */

import { createHash } from 'node:crypto';
import type { AiJob, AiJobState, Artifact, Policy, WorkItem } from '../../shared/types';
import type { BoardConnector } from './connectors/board';
import { SandboxBoardConnector } from './connectors/board';
import { resolveActiveEnvironmentId } from './environments';
import { enrichFromConnections } from './mcp/gateway';
import { mergePiiReports, sanitize, sanitizeForWriteback } from './pii';
import type { ModelRunner } from './runners/model';
import { SandboxModelRunner } from './runners/model';
import { emitAudit, nextId, type Store, TENANT_ID } from './store';

const ACTOR = { type: 'system', id: 'orchestrator' } as const;

export interface OrchestratorDeps {
  modelRunner: ModelRunner;
  boardConnector: BoardConnector;
}

function defaultDeps(store: Store): OrchestratorDeps {
  return {
    modelRunner: new SandboxModelRunner(),
    boardConnector: new SandboxBoardConnector(store),
  };
}

function transition(
  store: Store,
  job: AiJob,
  to: AiJobState,
  metadata: Record<string, unknown> = {},
  securityLayersApplied: number[] = [1, 2, 3],
): void {
  job.state = to;
  emitAudit(store, ACTOR, `job.state.${to}`, { type: 'ai_job', id: job.id }, metadata, securityLayersApplied);
}

/** Deterministic token accounting: ~4 chars/token input, 60% of that as output. */
export function estimateTokens(textLength: number): { input: number; output: number; total: number } {
  const input = Math.ceil(textLength / 4);
  const output = Math.ceil(input * 0.6);
  return { input, output, total: input + output };
}

function makeArtifact(
  store: Store,
  job: AiJob,
  policy: Policy,
  kind: Artifact['kind'],
  content: string,
  boardAttachmentId: string | null,
): Artifact {
  const id = nextId('art');
  return {
    id,
    aiJobId: job.id,
    kind,
    storage: {
      provider: policy.cloud.provider,
      uri: `${policy.cloud.provider}://${policy.cloud.region}/artifacts/${id}.md`,
    },
    checksum: createHash('sha256').update(content).digest('hex'),
    boardAttachmentId,
    preview: content.split('\n').slice(0, 2).join(' ').slice(0, 140),
    content,
  };
}

/**
 * Run the full pipeline. Async so real ModelRunner / BoardConnector can await I/O.
 * Returns the job in its terminal state (ready_for_human | blocked_pii | failed).
 */
export async function runJobPipeline(
  store: Store,
  job: AiJob,
  workItem: WorkItem,
  policy: Policy,
  targetCompletionPercent: number,
  deps: OrchestratorDeps = defaultDeps(store),
): Promise<AiJob> {
  transition(store, job, 'sanitizing', { workItemId: workItem.id }, [1, 2, 3, 5]);
  const titleResult = sanitize(workItem.title, policy);
  const bodyResult = sanitize(workItem.description, policy);
  let report = mergePiiReports(titleResult.report, bodyResult.report);
  let sanitized = `${titleResult.sanitized}\n\n${bodyResult.sanitized}`;
  job.piiReport = report;

  if (report.blocks.length > 0) {
    workItem.aiStatus = 'blocked_pii';
    workItem.lastAiJobId = job.id;
    workItem.updatedAt = new Date().toISOString();
    job.tokenUsage = { input: 0, output: 0, total: 0 };
    job.finishedAt = new Date().toISOString();
    transition(
      store,
      job,
      'blocked_pii',
      { workItemId: workItem.id, piiBlocks: report.blocks },
      [1, 2, 3, 5],
    );
    emitAudit(
      store,
      ACTOR,
      'pii.block',
      { type: 'work_item', id: workItem.id },
      { jobId: job.id, categories: report.blocks },
      [5],
    );
    store.notifications.push({
      id: nextId('ntf'),
      kind: 'pii_block',
      title: `PII block on ${workItem.board.issueKey}`,
      body: `AI job blocked: restricted data (${report.blocks.join(', ')}) detected. Sanitize the ticket before re-running.`,
      createdAt: new Date().toISOString(),
      read: false,
      workItemId: workItem.id,
    });
    return job;
  }

  const estimate = estimateTokens(sanitized.length);
  if (estimate.total > policy.tokenBudget.maxTotalTokens) {
    workItem.aiStatus = 'failed';
    workItem.lastAiJobId = job.id;
    workItem.updatedAt = new Date().toISOString();
    job.error = 'token_budget_exceeded';
    job.tokenUsage = { input: 0, output: 0, total: 0 };
    job.finishedAt = new Date().toISOString();
    transition(
      store,
      job,
      'failed',
      {
        workItemId: workItem.id,
        error: 'token_budget_exceeded',
        estimatedTotal: estimate.total,
        maxTotalTokens: policy.tokenBudget.maxTotalTokens,
      },
      [1, 2, 3, 4],
    );
    store.notifications.push({
      id: nextId('ntf'),
      kind: 'system',
      title: `Token budget exceeded on ${workItem.board.issueKey}`,
      body: `Estimated ${estimate.total} tokens > budget ${policy.tokenBudget.maxTotalTokens}. Job failed before any model call.`,
      createdAt: new Date().toISOString(),
      read: false,
      workItemId: workItem.id,
    });
    return job;
  }

  const envId =
    (policy.environmentId && policy.environmentId.length > 0
      ? policy.environmentId
      : null) ?? resolveActiveEnvironmentId(store, job.tenantId || TENANT_ID);
  const mcpConnections = (store.mcpConnectionsByTenant[TENANT_ID] ?? []).filter(
    (c) => c.environmentId === envId,
  );
  const enrichment = await enrichFromConnections(mcpConnections, workItem.board.issueKey, {
    store,
    tenantId: job.tenantId,
  });
  transition(
    store,
    job,
    'enriching_mcp',
    {
      workItemId: workItem.id,
      mcpServers: enrichment.servers,
      mcpCalls: enrichment.calls.length,
    },
    [1, 2, 5],
  );

  let modelInput = sanitized;
  if (enrichment.snippets.length > 0) {
    const mcpResult = sanitize(enrichment.snippets.join('\n'), policy);
    report = mergePiiReports(report, mcpResult.report);
    job.piiReport = report;
    if (mcpResult.report.blocks.length > 0) {
      workItem.aiStatus = 'blocked_pii';
      workItem.lastAiJobId = job.id;
      workItem.updatedAt = new Date().toISOString();
      job.tokenUsage = { input: 0, output: 0, total: 0 };
      job.finishedAt = new Date().toISOString();
      transition(
        store,
        job,
        'blocked_pii',
        { workItemId: workItem.id, piiBlocks: report.blocks, source: 'mcp' },
        [1, 2, 3, 5],
      );
      emitAudit(
        store,
        ACTOR,
        'pii.block',
        { type: 'work_item', id: workItem.id },
        { jobId: job.id, categories: report.blocks, source: 'mcp' },
        [5],
      );
      store.notifications.push({
        id: nextId('ntf'),
        kind: 'pii_block',
        title: `PII block on ${workItem.board.issueKey}`,
        body: `AI job blocked: restricted data in MCP context (${mcpResult.report.blocks.join(', ')}).`,
        createdAt: new Date().toISOString(),
        read: false,
        workItemId: workItem.id,
      });
      return job;
    }
    modelInput = `${sanitized}\n\n--- MCP context ---\n${mcpResult.sanitized}`;
  }

  workItem.aiStatus = 'running';
  transition(
    store,
    job,
    'running',
    {
      workItemId: workItem.id,
      model: policy.model.modelId,
      cloud: `${policy.cloud.provider}/${policy.cloud.region}`,
      runner: deps.modelRunner.kind,
      mcpEnriched: enrichment.snippets.length > 0,
    },
    [1, 2, 3, 4, 5],
  );

  let draft: string;
  try {
    const result = await deps.modelRunner.run({
      workItem,
      sanitized: modelInput,
      sanitizedTitle: titleResult.sanitized,
      policy,
      targetCompletionPercent,
    });
    draft = result.draft;
    job.model = { provider: result.provider, modelId: result.modelId };
  } catch (err) {
    workItem.aiStatus = 'failed';
    workItem.lastAiJobId = job.id;
    workItem.updatedAt = new Date().toISOString();
    job.error = err instanceof Error ? err.message : 'model_runner_failed';
    job.tokenUsage = { input: 0, output: 0, total: 0 };
    job.finishedAt = new Date().toISOString();
    transition(
      store,
      job,
      'failed',
      { workItemId: workItem.id, error: job.error },
      [1, 2, 3, 4],
    );
    return job;
  }

  // Secondary scan: clear any PII the model echoed before board write-back.
  draft = sanitizeForWriteback(draft, policy).sanitized;

  job.tokenUsage = estimate;

  transition(store, job, 'packaging', { workItemId: workItem.id, tokens: job.tokenUsage.total }, [1, 2, 3, 4]);

  transition(store, job, 'attaching', { workItemId: workItem.id, board: deps.boardConnector.kind }, [1, 2, 3, 6]);
  try {
    const summaryAttach = await deps.boardConnector.addAttachment(workItem, {
      filename: `aplifyai-ai-${job.id}-summary.md`,
      contentType: 'text/markdown',
      body: draft,
    });
    const patchBody = `--- a/${workItem.board.issueKey.toLowerCase()}.md\n+++ b/${workItem.board.issueKey.toLowerCase()}.md\n@@ draft @@\n+${draft.split('\n')[0]}\n`;
    const patchAttach = await deps.boardConnector.addAttachment(workItem, {
      filename: `aplifyai-ai-${job.id}.patch`,
      contentType: 'text/x-diff',
      body: patchBody,
    });

    job.artifacts = [
      makeArtifact(store, job, policy, 'summary', draft, summaryAttach.attachmentId),
      makeArtifact(store, job, policy, 'patch', patchBody, patchAttach.attachmentId),
    ];

    const comment = await deps.boardConnector.addComment(
      workItem,
      `AplifyAI AI draft ready (${targetCompletionPercent}% target). Artifacts: ${job.artifacts
        .map((a) => a.boardAttachmentId)
        .join(', ')}. Review before human hand-off.`,
    );
    emitAudit(
      store,
      ACTOR,
      'board.writeback.completed',
      { type: 'work_item', id: workItem.id },
      {
        jobId: job.id,
        commentId: comment.commentId,
        attachmentIds: job.artifacts.map((artifact) => artifact.boardAttachmentId),
      },
      [1, 2, 3, 6],
    );
  } catch (err) {
    workItem.aiStatus = 'failed';
    workItem.lastAiJobId = job.id;
    workItem.updatedAt = new Date().toISOString();
    job.error = err instanceof Error ? err.message : 'board_writeback_failed';
    job.finishedAt = new Date().toISOString();
    transition(store, job, 'failed', { workItemId: workItem.id, error: job.error }, [1, 2, 3, 6]);
    return job;
  }

  job.finishedAt = new Date().toISOString();
  workItem.aiStatus = 'ready_for_human';
  workItem.lastAiJobId = job.id;
  workItem.updatedAt = new Date().toISOString();
  transition(
    store,
    job,
    'ready_for_human',
    { workItemId: workItem.id, attachments: job.artifacts.map((a) => a.boardAttachmentId) },
    [1, 2, 3, 6],
  );
  store.notifications.push({
    id: nextId('ntf'),
    kind: 'ai_ready',
    title: `AI draft ready on ${workItem.board.issueKey}`,
    body: `${job.artifacts.length} artifacts attached (${job.tokenUsage.total} tokens, ${report.redactions} PII redactions). Review before hand-off.`,
    createdAt: new Date().toISOString(),
    read: false,
    workItemId: workItem.id,
  });
  return job;
}

/** Create a job in 'queued' state (with its audit event) for an AI-first triage. */
export function createJob(store: Store, workItem: WorkItem, policy: Policy): AiJob {
  const job: AiJob = {
    id: nextId('job'),
    workItemId: workItem.id,
    tenantId: TENANT_ID,
    state: 'queued',
    model: { provider: policy.model.provider, modelId: policy.model.modelId },
    cloudExecution: {
      provider: policy.cloud.provider,
      mode: policy.cloud.mode,
      region: policy.cloud.region,
      ...(policy.cloud.customLabel ? { customLabel: policy.cloud.customLabel } : {}),
    },
    tokenUsage: { input: 0, output: 0, total: 0 },
    artifacts: [],
    piiReport: { redactions: 0, blocks: [] },
    error: null,
    createdAt: new Date().toISOString(),
    finishedAt: null,
  };
  store.jobs.push(job);
  workItem.lastAiJobId = job.id;
  emitAudit(
    store,
    ACTOR,
    'job.state.queued',
    { type: 'ai_job', id: job.id },
    { workItemId: workItem.id },
    [1, 2, 3],
  );
  return job;
}
