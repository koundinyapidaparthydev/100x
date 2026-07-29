/**
 * REST routes — all JSON, mounted under /api/v1 (see shared/api.ts client contract).
 */

import { Router } from 'express';
import type {
  AiStatus,
  BoardHealth,
  DashboardStats,
  TriageRequest,
  TriageResponse,
} from '../../shared/types';
import { createJob, runJobPipeline } from './orchestrator';
import { emitAudit, ORG_POLICY_ID, type Store, TENANT_ID } from './store';

const MS_24H = 24 * 3_600_000;

export function createRouter(store: Store): Router {
  const router = Router();

  const findWorkItem = (id: string) => store.workItems.find((w) => w.id === id);
  const orgPolicy = () => store.policies.find((p) => p.id === ORG_POLICY_ID) ?? store.policies[0];

  // -- health ----------------------------------------------------------------
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0' });
  });

  // -- work items --------------------------------------------------------------
  router.get('/work-items', (req, res) => {
    const { aiStatus, aiFirst } = req.query;
    let items = store.workItems;
    if (typeof aiStatus === 'string' && aiStatus.length > 0) {
      items = items.filter((w) => w.aiStatus === (aiStatus as AiStatus));
    }
    if (aiFirst === 'true' || aiFirst === 'false') {
      const flag = aiFirst === 'true';
      items = items.filter((w) => w.aiFirst === flag);
    }
    res.json(items);
  });

  router.get('/work-items/:id', (req, res) => {
    const item = findWorkItem(req.params.id);
    if (!item) {
      res.status(404).json({ error: `work item not found: ${req.params.id}` });
      return;
    }
    res.json(item);
  });

  // Manager swipe decision (mobile). aiFirst=true runs the orchestrator pipeline
  // SYNCHRONOUSLY so the response carries the job's terminal state.
  router.post('/work-items/:id/triage', (req, res) => {
    const item = findWorkItem(req.params.id);
    if (!item) {
      res.status(404).json({ error: `work item not found: ${req.params.id}` });
      return;
    }
    const body = (req.body ?? {}) as Partial<TriageRequest>;
    if (typeof body.aiFirst !== 'boolean') {
      res.status(400).json({ error: 'body.aiFirst (boolean) is required' });
      return;
    }
    const policy = orgPolicy();
    if (!policy) {
      res.status(500).json({ error: 'no policy configured for tenant' });
      return;
    }

    item.aiFirst = body.aiFirst;
    item.targetCompletionPercent =
      typeof body.targetCompletionPercent === 'number'
        ? body.targetCompletionPercent
        : policy.targetCompletionPercentDefault;
    item.updatedAt = new Date().toISOString();

    let response: TriageResponse;
    if (!body.aiFirst) {
      // Human-first: route to humans, no AI job is created.
      item.aiStatus = 'none';
      emitAudit(
        store,
        { type: 'manager_mobile', id: 'manager-1' },
        'triage.human_first',
        { type: 'work_item', id: item.id },
        { issueKey: item.board.issueKey, targetCompletionPercent: item.targetCompletionPercent },
        [1, 2, 3],
      );
      response = { workItem: item, job: null };
    } else {
      emitAudit(
        store,
        { type: 'manager_mobile', id: 'manager-1' },
        'triage.ai_first',
        { type: 'work_item', id: item.id },
        { issueKey: item.board.issueKey, targetCompletionPercent: item.targetCompletionPercent },
        [1, 2, 3],
      );
      item.aiStatus = 'queued';
      const job = createJob(store, item, policy);
      runJobPipeline(store, job, item, policy, item.targetCompletionPercent);
      response = { workItem: item, job };
    }
    res.json(response);
  });

  // -- boards (derived from seeded Jira projects) ------------------------------
  router.get('/boards', (_req, res) => {
    const projects = new Map<string, { name: string }>([
      ['OH', { name: 'OffshoreHelper Core' }],
      ['INFRA', { name: 'Infrastructure' }],
      ['FE', { name: 'Frontend' }],
    ]);
    const boards: BoardHealth[] = [...projects.entries()].map(([projectId, { name }]) => {
      const items = store.workItems.filter((w) => w.board.projectId === projectId);
      const latest = items.reduce((acc, w) => (w.updatedAt > acc ? w.updatedAt : acc), '');
      const blocked = items.some((w) => w.aiStatus === 'blocked_pii');
      const aiActive = items.some((w) => w.aiFirst);
      return {
        projectId,
        issuePrefix: projectId,
        name,
        state: 'healthy',
        lastSyncAt: latest || new Date().toISOString(),
        activeIssues: items.length,
        aiReadiness: blocked ? 'blocked' : aiActive ? 'optimal' : 'evaluating',
      };
    });
    res.json(boards);
  });

  // -- AI jobs -----------------------------------------------------------------
  router.get('/ai-jobs', (_req, res) => {
    res.json(store.jobs);
  });

  router.get('/ai-jobs/:id', (req, res) => {
    const job = store.jobs.find((j) => j.id === req.params.id);
    if (!job) {
      res.status(404).json({ error: `ai job not found: ${req.params.id}` });
      return;
    }
    res.json(job);
  });

  // -- policies ------------------------------------------------------------------
  router.get('/policies', (_req, res) => {
    res.json(store.policies);
  });

  router.get('/policies/:id', (req, res) => {
    const policy = store.policies.find((p) => p.id === req.params.id);
    if (!policy) {
      res.status(404).json({ error: `policy not found: ${req.params.id}` });
      return;
    }
    res.json(policy);
  });

  // -- audit (newest first) -------------------------------------------------------
  router.get('/audit-events', (_req, res) => {
    res.json([...store.auditEvents].reverse());
  });

  // -- dashboard stats -------------------------------------------------------------
  router.get('/stats', (_req, res) => {
    const now = Date.now();
    const policy = orgPolicy();
    const maxTokens = policy?.tokenBudget.maxTotalTokens ?? 0;

    const activeJobs = store.jobs.filter(
      (j) => j.state === 'running' || j.state === 'sanitizing' || j.state === 'packaging' || j.state === 'attaching',
    ).length;
    const queuedJobs = store.jobs.filter((j) => j.state === 'queued').length;
    const readyForHuman = store.jobs.filter((j) => j.state === 'ready_for_human').length;

    // 24h windows from the audit trail (blocks) and job reports (redactions).
    const piiBlocks24h = store.auditEvents.filter(
      (e) => e.action === 'job.state.blocked_pii' && now - Date.parse(e.createdAt) < MS_24H,
    ).length;
    const piiRedactions24h = store.jobs
      .filter((j) => now - Date.parse(j.createdAt) < MS_24H)
      .reduce((sum, j) => sum + j.piiReport.redactions, 0);

    const today = new Date().toISOString().slice(0, 10);
    const tokenUsageToday = store.jobs
      .filter((j) => j.createdAt.slice(0, 10) === today)
      .reduce(
        (acc, j) => ({
          input: acc.input + j.tokenUsage.input,
          output: acc.output + j.tokenUsage.output,
          total: acc.total + j.tokenUsage.total,
        }),
        { input: 0, output: 0, total: 0 },
      );

    const stats: DashboardStats = {
      activeJobs,
      queuedJobs,
      readyForHuman,
      piiBlocks24h,
      piiRedactions24h,
      tokenUsageToday,
      tokenBudget: maxTokens,
      tokenBudgetUsedPercent:
        maxTokens > 0 ? Math.round((tokenUsageToday.total / maxTokens) * 1000) / 10 : 0,
    };
    res.json(stats);
  });

  // -- approvals ---------------------------------------------------------------------
  router.get('/approvals', (_req, res) => {
    res.json(store.approvals);
  });

  router.post('/approvals/:id/decision', (req, res) => {
    const approval = store.approvals.find((a) => a.id === req.params.id);
    if (!approval) {
      res.status(404).json({ error: `approval not found: ${req.params.id}` });
      return;
    }
    const decision = (req.body ?? {}).decision;
    if (decision !== 'approved' && decision !== 'rejected') {
      res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
      return;
    }
    approval.status = decision;
    // Audited either way — high-risk actions must be attributable (ARCHITECTURE rules).
    emitAudit(
      store,
      { type: 'manager_mobile', id: 'manager-1' },
      `approval.${decision}`,
      { type: 'approval', id: approval.id },
      { workItemId: approval.workItemId, title: approval.title, risk: approval.risk },
      [1, 2, 4],
    );
    res.json(approval);
  });

  // -- notifications -------------------------------------------------------------------
  router.get('/notifications', (_req, res) => {
    res.json([...store.notifications].reverse()); // newest first
  });

  return router;
}
