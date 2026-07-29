/**
 * AI job orchestrator (docs/ai/AI_DELEGATION.md, docs/SCHEMA_SKETCH.md hard rules).
 *
 * State machine (synchronous + deterministic so tests can assert end state):
 *
 *   queued → sanitizing → (blocked_pii | running) → packaging → attaching → ready_for_human
 *
 * `enriching_mcp` is intentionally SKIPPED: the MCP context layer (ARCHITECTURE.md
 * component 6) has no real tool servers in this foundation build, and the org
 * policy allowlist only grants read-only Jira tools whose data is already on the
 * WorkItem. The state remains in the shared type for when MCP lands.
 *
 * Hard rules enforced here:
 *  - a job NEVER enters 'running' unless the sanitizing step succeeded (no PII blocks)
 *  - EVERY state transition emits an AuditEvent
 *  - artifact storage URIs respect policy.cloud.provider/region
 *  - token estimate is checked against policy.tokenBudget BEFORE the model runs
 */

import { createHash } from 'node:crypto';
import type { AiJob, AiJobState, Artifact, Policy, WorkItem } from '../../shared/types';
import { sanitize } from './pii';
import { emitAudit, nextId, type Store, TENANT_ID } from './store';

const ACTOR = { type: 'system', id: 'orchestrator' } as const;

/** Record a transition: mutate job state + emit the mandatory audit event. */
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

/**
 * Dummy/sandbox model runner (FOUNDATION F4 — no real model calls in CI).
 * Output is derived deterministically from the sanitized ticket text.
 */
function runSandboxModel(workItem: WorkItem, sanitized: string, targetPercent: number): string {
  return [
    `# AI Draft (${targetPercent}% target) — ${workItem.board.issueKey}: ${workItem.title}`,
    '',
    '## Understanding',
    `Sanitized ticket payload (${sanitized.length} chars) was analyzed by the sandbox runner.`,
    '',
    '## Draft plan',
    `- Restate scope: ${workItem.title.toLowerCase()}.`,
    '- Identify touched modules and write a failing test sketch.',
    '- Produce a draft patch; leave merge + edge cases to the human assignee.',
    '',
    '## Remaining work (human hand-off)',
    '- Verify assumptions against the real repo.',
    '- Complete implementation past the draft and run full CI.',
  ].join('\n');
}

function makeArtifact(
  store: Store,
  job: AiJob,
  policy: Policy,
  kind: Artifact['kind'],
  content: string,
): Artifact {
  const id = nextId('art');
  store.attachmentCounter += 1;
  return {
    id,
    aiJobId: job.id,
    kind,
    storage: {
      provider: policy.cloud.provider,
      // Hard rule: storage URI must respect tenant cloud policy (provider + region).
      uri: `${policy.cloud.provider}://${policy.cloud.region}/artifacts/${id}.md`,
    },
    checksum: createHash('sha256').update(content).digest('hex'),
    boardAttachmentId: `att-${store.attachmentCounter}`,
    preview: content.split('\n').slice(0, 2).join(' ').slice(0, 140),
  };
}

/**
 * Run the full pipeline for a freshly created job. Synchronous by design.
 * Returns the job in its terminal state (ready_for_human | blocked_pii | failed).
 */
export function runJobPipeline(
  store: Store,
  job: AiJob,
  workItem: WorkItem,
  policy: Policy,
  targetCompletionPercent: number,
): AiJob {
  // --- sanitizing (mandatory PII gate; nothing reaches the model without it) ---
  transition(store, job, 'sanitizing', { workItemId: workItem.id }, [1, 2, 3, 5]);
  const { sanitized, report } = sanitize(
    `${workItem.title}\n\n${workItem.description}`,
    policy,
  );
  job.piiReport = report;

  if (report.blocks.length > 0) {
    // Blocked: never enter 'running', never consume tokens.
    workItem.aiStatus = 'blocked_pii';
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

  // --- token budget gate: estimate BEFORE the model runs ---
  const estimate = estimateTokens(sanitized.length);
  if (estimate.total > policy.tokenBudget.maxTotalTokens) {
    workItem.aiStatus = 'failed';
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

  // --- running (only reachable after a clean sanitizing step) ---
  workItem.aiStatus = 'running';
  transition(
    store,
    job,
    'running',
    { workItemId: workItem.id, model: policy.model.modelId, cloud: `${policy.cloud.provider}/${policy.cloud.region}` },
    [1, 2, 3, 4, 5],
  );
  const draft = runSandboxModel(workItem, sanitized, targetCompletionPercent);
  job.tokenUsage = estimate; // deterministic runner: actual == estimate

  // --- packaging: summary + patch artifacts with checksums ---
  transition(store, job, 'packaging', { workItemId: workItem.id, tokens: job.tokenUsage.total }, [1, 2, 3, 4]);
  job.artifacts = [
    makeArtifact(store, job, policy, 'summary', draft),
    makeArtifact(
      store,
      job,
      policy,
      'patch',
      `--- a/${workItem.board.issueKey.toLowerCase()}.md\n+++ b/${workItem.board.issueKey.toLowerCase()}.md\n@@ draft @@\n+${draft.split('\n')[0]}\n`,
    ),
  ];

  // --- attaching: write-back to the board ---
  transition(
    store,
    job,
    'attaching',
    { workItemId: workItem.id, artifactIds: job.artifacts.map((a) => a.id) },
    [1, 2, 3, 6],
  );

  // --- ready_for_human: hand-off package complete ---
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
    },
    tokenUsage: { input: 0, output: 0, total: 0 },
    artifacts: [],
    piiReport: { redactions: 0, blocks: [] },
    error: null,
    createdAt: new Date().toISOString(),
    finishedAt: null,
  };
  store.jobs.push(job);
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
