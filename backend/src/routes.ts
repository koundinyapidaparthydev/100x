/**
 * REST routes — all JSON, mounted under /api/v1 (see shared/api.ts client contract).
 */

import { Router } from 'express';
import type {
  AccessRequestBody,
  AiStatus,
  BoardConnectRequest,
  BoardHealth,
  DashboardStats,
  PolicyUpdate,
  TriageRequest,
  TriageResponse,
  WorkItem,
  WorkItemAssigneeUpdate,
} from '../../shared/types';
import { createJob, runJobPipeline } from './orchestrator';
import { emitAudit, nextId, ORG_POLICY_ID, type Store, TENANT_ID } from './store';

const MS_24H = 24 * 3_600_000;

function actorFrom(req: { headers: Record<string, unknown> }): { type: 'manager_mobile' | 'user'; id: string } {
  const raw = req.headers['x-actor-id'];
  const id = typeof raw === 'string' && raw.trim() ? raw.trim() : 'manager-1';
  const surface = req.headers['x-actor-surface'];
  const type = surface === 'web' ? 'user' : 'manager_mobile';
  return { type, id };
}

function boardHealth(store: Store): BoardHealth[] {
  return store.boards.map((board) => {
    const items = store.workItems.filter((w) => w.board.projectId === board.projectId);
    const latest = items.reduce((acc, w) => (w.updatedAt > acc ? w.updatedAt : acc), board.lastSyncAt);
    const blocked = items.some((w) => w.aiStatus === 'blocked_pii');
    const aiActive = items.some((w) => w.aiFirst);
    return {
      projectId: board.projectId,
      issuePrefix: board.projectId,
      name: board.name,
      state: 'healthy' as const,
      lastSyncAt: latest || board.lastSyncAt,
      activeIssues: items.length,
      aiReadiness: blocked ? ('blocked' as const) : aiActive ? ('optimal' as const) : ('evaluating' as const),
      connected: true,
    };
  });
}

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
    const { aiStatus, aiFirst, projectId, triagePending } = req.query;
    let items = store.workItems;
    if (typeof aiStatus === 'string' && aiStatus.length > 0) {
      items = items.filter((w) => w.aiStatus === (aiStatus as AiStatus));
    }
    if (aiFirst === 'true' || aiFirst === 'false') {
      const flag = aiFirst === 'true';
      items = items.filter((w) => w.aiFirst === flag);
    }
    if (typeof projectId === 'string' && projectId.length > 0) {
      items = items.filter((w) => w.board.projectId === projectId);
    }
    if (triagePending === 'true') {
      items = items.filter((w) => w.lastTriageDecision === null && w.aiStatus === 'none');
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

  router.patch('/work-items/:id/assignee', (req, res) => {
    const item = findWorkItem(req.params.id);
    if (!item) {
      res.status(404).json({ error: `work item not found: ${req.params.id}` });
      return;
    }
    const body = (req.body ?? {}) as WorkItemAssigneeUpdate;
    if (!('assigneeExternalId' in body)) {
      res.status(400).json({ error: 'body.assigneeExternalId is required (string | null)' });
      return;
    }
    if (body.assigneeExternalId !== null && typeof body.assigneeExternalId !== 'string') {
      res.status(400).json({ error: 'assigneeExternalId must be string or null' });
      return;
    }
    item.assigneeExternalId = body.assigneeExternalId;
    item.updatedAt = new Date().toISOString();
    emitAudit(
      store,
      actorFrom(req),
      'work_item.assignee_updated',
      { type: 'work_item', id: item.id },
      { assigneeExternalId: item.assigneeExternalId, issueKey: item.board.issueKey },
      [1, 2, 3],
    );
    res.json(item);
  });

  router.post('/work-items/:id/request-access', (req, res) => {
    const item = findWorkItem(req.params.id);
    if (!item) {
      res.status(404).json({ error: `work item not found: ${req.params.id}` });
      return;
    }
    const body = (req.body ?? {}) as AccessRequestBody;
    const approval = {
      id: nextId('app'),
      workItemId: item.id,
      title: `PII access request on ${item.board.issueKey}`,
      reason:
        typeof body.reason === 'string' && body.reason.trim()
          ? body.reason.trim()
          : 'Manager requested temporary PII policy relaxation to re-run AI after a block.',
      risk: 'high' as const,
      status: 'pending' as const,
      requestedAt: new Date().toISOString(),
    };
    store.approvals.push(approval);
    store.notifications.push({
      id: nextId('ntf'),
      kind: 'approval',
      title: `Approval needed: ${item.board.issueKey}`,
      body: approval.reason,
      createdAt: new Date().toISOString(),
      read: false,
      workItemId: item.id,
    });
    emitAudit(
      store,
      actorFrom(req),
      'pii.access_requested',
      { type: 'approval', id: approval.id },
      { workItemId: item.id, issueKey: item.board.issueKey },
      [1, 2, 5],
    );
    res.status(201).json(approval);
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
      item.aiStatus = 'none';
      item.lastTriageDecision = 'human_first';
      emitAudit(
        store,
        actorFrom(req),
        'triage.human_first',
        { type: 'work_item', id: item.id },
        { issueKey: item.board.issueKey, targetCompletionPercent: item.targetCompletionPercent },
        [1, 2, 3],
      );
      response = { workItem: item, job: null };
    } else {
      item.lastTriageDecision = 'ai_first';
      emitAudit(
        store,
        actorFrom(req),
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

  // -- boards ------------------------------------------------------------------
  router.get('/boards', (_req, res) => {
    res.json(boardHealth(store));
  });

  router.post('/boards/connect', (req, res) => {
    const body = (req.body ?? {}) as Partial<BoardConnectRequest>;
    if (typeof body.projectId !== 'string' || !body.projectId.trim()) {
      res.status(400).json({ error: 'body.projectId is required' });
      return;
    }
    if (typeof body.name !== 'string' || !body.name.trim()) {
      res.status(400).json({ error: 'body.name is required' });
      return;
    }
    const projectId = body.projectId.trim().toUpperCase();
    if (store.boards.some((b) => b.projectId === projectId)) {
      res.status(409).json({ error: `board already connected: ${projectId}` });
      return;
    }
    const now = new Date().toISOString();
    store.boards.push({
      projectId,
      name: body.name.trim(),
      connectedAt: now,
      lastSyncAt: now,
    });

    const seeds = Array.isArray(body.seedIssues) ? body.seedIssues : [];
    for (const [index, seed] of seeds.entries()) {
      if (!seed?.title) continue;
      const n = store.workItems.filter((w) => w.board.projectId === projectId).length + index + 1;
      const issueKey = `${projectId}-${100 + n}`;
      const wi: WorkItem = {
        id: nextId('wi'),
        tenantId: TENANT_ID,
        board: {
          type: 'jira',
          projectId,
          issueKey,
          issueId: String(40_000 + store.workItems.length + index),
        },
        title: seed.title,
        status: 'To Do',
        assigneeExternalId: null,
        labels: ['imported'],
        aiFirst: false,
        targetCompletionPercent: orgPolicy()?.targetCompletionPercentDefault ?? 20,
        aiStatus: 'none',
        lastAiJobId: null,
        lastTriageDecision: null,
        description: seed.description ?? `Imported sandbox issue for ${issueKey}.`,
        priority: seed.priority ?? 'medium',
        updatedAt: now,
      };
      store.workItems.push(wi);
    }

    emitAudit(
      store,
      actorFrom(req),
      'board.connected',
      { type: 'board', id: projectId },
      { name: body.name.trim(), seeded: seeds.length },
      [1, 2, 3],
    );
    res.status(201).json(boardHealth(store).find((b) => b.projectId === projectId));
  });

  router.post('/boards/:projectId/sync', (req, res) => {
    const projectId = req.params.projectId.toUpperCase();
    const board = store.boards.find((b) => b.projectId === projectId);
    if (!board) {
      res.status(404).json({ error: `board not connected: ${projectId}` });
      return;
    }
    board.lastSyncAt = new Date().toISOString();
    emitAudit(
      store,
      actorFrom(req),
      'board.synced',
      { type: 'board', id: projectId },
      { activeIssues: store.workItems.filter((w) => w.board.projectId === projectId).length },
      [1, 2, 3],
    );
    res.json(boardHealth(store).find((b) => b.projectId === projectId));
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

  router.patch('/policies/:id', (req, res) => {
    const policy = store.policies.find((p) => p.id === req.params.id);
    if (!policy) {
      res.status(404).json({ error: `policy not found: ${req.params.id}` });
      return;
    }
    const body = (req.body ?? {}) as PolicyUpdate;
    const changed: string[] = [];

    if (body.securityLevel !== undefined) {
      policy.securityLevel = body.securityLevel;
      changed.push('securityLevel');
    }
    if (body.pii !== undefined) {
      policy.pii = { ...policy.pii, ...body.pii };
      changed.push('pii');
    }
    if (body.cloud !== undefined) {
      policy.cloud = { ...policy.cloud, ...body.cloud };
      changed.push('cloud');
    }
    if (body.model !== undefined) {
      policy.model = { ...policy.model, ...body.model };
      changed.push('model');
    }
    if (body.platform !== undefined) {
      policy.platform = { ...policy.platform, ...body.platform };
      changed.push('platform');
    }
    if (body.tokenBudget !== undefined) {
      policy.tokenBudget = { ...policy.tokenBudget, ...body.tokenBudget };
      changed.push('tokenBudget');
    }
    if (body.mcpAllowlist !== undefined) {
      policy.mcpAllowlist = body.mcpAllowlist;
      changed.push('mcpAllowlist');
    }
    if (typeof body.aiFirstDefault === 'boolean') {
      policy.aiFirstDefault = body.aiFirstDefault;
      changed.push('aiFirstDefault');
    }
    if (typeof body.targetCompletionPercentDefault === 'number') {
      policy.targetCompletionPercentDefault = body.targetCompletionPercentDefault;
      changed.push('targetCompletionPercentDefault');
    }
    if (body.locks !== undefined) {
      policy.locks = { ...policy.locks, ...body.locks };
      changed.push('locks');
    }

    if (changed.length === 0) {
      res.status(400).json({ error: 'no recognized policy fields to update' });
      return;
    }

    emitAudit(
      store,
      actorFrom(req),
      'policy.updated',
      { type: 'policy', id: policy.id },
      { changed },
      [1, 2, 3, 4],
    );
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
    emitAudit(
      store,
      actorFrom(req),
      `approval.${decision}`,
      { type: 'approval', id: approval.id },
      { workItemId: approval.workItemId, title: approval.title, risk: approval.risk },
      [1, 2, 4],
    );
    res.json(approval);
  });

  // -- notifications -------------------------------------------------------------------
  router.get('/notifications', (_req, res) => {
    res.json([...store.notifications].reverse());
  });

  router.post('/notifications/:id/read', (req, res) => {
    const ntf = store.notifications.find((n) => n.id === req.params.id);
    if (!ntf) {
      res.status(404).json({ error: `notification not found: ${req.params.id}` });
      return;
    }
    ntf.read = true;
    res.json(ntf);
  });

  router.post('/notifications/read-all', (_req, res) => {
    for (const n of store.notifications) n.read = true;
    res.json({ ok: true, count: store.notifications.length });
  });

  return router;
}
