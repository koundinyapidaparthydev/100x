/**
 * REST routes — all JSON, mounted under /api/v1 (see shared/api.ts client contract).
 */

import { Router } from 'express';
import {
  getMcpProvider,
  MCP_PROVIDERS,
  mcpAvailabilityLabel,
  type McpPermissionLevel,
} from '../../shared/mcpProviders';
import { mergePiiUpdate, normalizeCustomerNames } from '../../shared/piiPolicy';
import type {
  AccessRequestBody,
  AiStatus,
  BoardConnectRequest,
  BoardHealth,
  DashboardStats,
  LoginRequest,
  McpAllowlistEntry,
  McpConnectRequest,
  OnboardingProfile,
  OnboardingUpsertRequest,
  PolicyUpdate,
  ServiceId,
  ServiceMcpConnection,
  TriageRequest,
  TriageResponse,
  WorkItem,
  WorkItemAssigneeUpdate,
} from '../../shared/types';
import {
  actorFromAuth,
  demoAuthEnabled,
  issueSession,
  listDemoUsers,
  requireRoles,
  revokeSession,
  type AuthedRequest,
} from './auth';
import {
  allowlistEntriesFromConnections,
  callToolAsync,
  createConnection,
} from './mcp/gateway';
import {
  buildAtlassianAuthorizeUrl,
  completeAtlassianOAuthCallback,
  getAtlassianMcpOAuthStatus,
} from './mcp/atlassianOAuth';
import { listConfiguredTransports } from './mcp/transports';
import {
  allProvidersStatus,
  buildAuthorizeUrl,
  clientCallbackUrl,
  completeCallback,
  consumeExchange,
  FEDERATED_PROVIDERS,
  isFederatedProvider,
  loginErrorRedirect,
  providerStatus,
  type AuthIntent,
} from './federatedOidc';
import type { OrchestratorDeps } from './orchestrator';
import { createJob, runJobPipeline } from './orchestrator';
import { scheduleSave } from './persist';
import { emitAudit, nextId, ORG_POLICY_ID, type Store, TENANT_ID } from './store';

const PERMISSION_LEVELS: McpPermissionLevel[] = ['read', 'write', 'admin'];

function isPermissionLevel(value: unknown): value is McpPermissionLevel {
  return typeof value === 'string' && (PERMISSION_LEVELS as string[]).includes(value);
}

function tenantConnections(store: Store, tenantId: string): ServiceMcpConnection[] {
  if (!store.mcpConnectionsByTenant[tenantId]) {
    store.mcpConnectionsByTenant[tenantId] = [];
  }
  return store.mcpConnectionsByTenant[tenantId]!;
}

function syncPolicyAllowlistFromConnections(store: Store, tenantId: string): void {
  const policy = store.policies.find((p) => p.id === ORG_POLICY_ID && p.tenantId === tenantId);
  if (!policy) return;
  const fromConn = allowlistEntriesFromConnections(tenantConnections(store, tenantId));
  if (fromConn.length === 0) return;
  const byServer = new Map(policy.mcpAllowlist.map((e) => [e.server, e]));
  for (const entry of fromConn) {
    byServer.set(entry.server, entry);
  }
  policy.mcpAllowlist = [...byServer.values()];
}

const MS_24H = 24 * 3_600_000;

function mcpStubsFromServices(services: ServiceId[]): McpAllowlistEntry[] {
  const seen = new Set<string>();
  const entries: McpAllowlistEntry[] = [];
  for (const id of services) {
    const provider = getMcpProvider(id);
    if (!provider || seen.has(provider.serverId)) continue;
    seen.add(provider.serverId);
    entries.push({ server: provider.serverId, tools: ['*'] });
  }
  return entries;
}

function isOnboardingProfile(value: unknown): value is OnboardingProfile {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<OnboardingProfile>;
  return (
    (p.plan === 'free' || p.plan === 'enterprise') &&
    Array.isArray(p.selectedServices) &&
    typeof p.updatedAt === 'string' &&
    (p.completedAt === null || typeof p.completedAt === 'string') &&
    typeof p.otherByCategory === 'object' &&
    p.otherByCategory !== null
  );
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

export function createRouter(store: Store, deps: OrchestratorDeps): Router {
  const router = Router();

  const findWorkItem = (id: string) => store.workItems.find((w) => w.id === id);
  const orgPolicy = () => store.policies.find((p) => p.id === ORG_POLICY_ID) ?? store.policies[0];
  const touch = () => scheduleSave(store);
  const upsertBoardIssue = (issue: Awaited<ReturnType<OrchestratorDeps['boardConnector']['syncProject']>>['issues'][number]) => {
    const existing = store.workItems.find(
      (item) => item.board.issueId === issue.issueId || item.board.issueKey === issue.issueKey,
    );
    if (existing) {
      existing.board.projectId = issue.projectId;
      existing.title = issue.title;
      existing.description = issue.description;
      existing.status = issue.status;
      existing.assigneeExternalId = issue.assigneeExternalId;
      existing.labels = [...issue.labels];
      existing.priority = issue.priority;
      existing.updatedAt = issue.updatedAt;
      return existing;
    }
    const item: WorkItem = {
      id: nextId('wi'),
      tenantId: TENANT_ID,
      board: {
        type: 'jira',
        projectId: issue.projectId,
        issueKey: issue.issueKey,
        issueId: issue.issueId,
      },
      title: issue.title,
      description: issue.description,
      status: issue.status,
      assigneeExternalId: issue.assigneeExternalId,
      labels: [...issue.labels],
      priority: issue.priority,
      updatedAt: issue.updatedAt,
      aiFirst: false,
      targetCompletionPercent: orgPolicy()?.targetCompletionPercentDefault ?? 20,
      aiStatus: 'none',
      lastAiJobId: null,
      lastTriageDecision: null,
    };
    store.workItems.push(item);
    return item;
  };

  // -- auth (H1) ---------------------------------------------------------------
  router.get('/auth/demo-users', (_req, res) => {
    if (!demoAuthEnabled()) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(listDemoUsers().map(({ id, displayName, email, role }) => ({ id, displayName, email, role })));
  });

  router.post('/auth/login', (req, res) => {
    const body = (req.body ?? {}) as Partial<LoginRequest>;
    if (typeof body.identity !== 'string' || !body.identity.trim()) {
      res.status(400).json({ error: 'body.identity is required (founder|manager|engineer|auditor or email)' });
      return;
    }
    if (!demoAuthEnabled()) {
      res.status(404).json({ error: 'demo login disabled' });
      return;
    }
    const session = issueSession({
      identity: body.identity,
      surface: body.surface === 'mobile' ? 'mobile' : 'web',
    });
    if (!session) {
      res.status(401).json({ error: 'unknown identity' });
      return;
    }
    emitAudit(
      store,
      { type: session.user.surface === 'mobile' ? 'manager_mobile' : 'user', id: session.user.id },
      'auth.login',
      { type: 'session', id: session.user.id },
      { role: session.user.role, surface: session.user.surface },
      [1, 2],
    );
    touch();
    res.json({ session });
  });

  router.post('/auth/logout', (req: AuthedRequest, res) => {
    if (req.authToken) revokeSession(req.authToken);
    res.json({ ok: true });
  });

  // -- Federated OIDC (Okta, Entra, Google Workspace, Google, Apple) ------------
  router.get('/auth/providers', (_req, res) => {
    res.json({ providers: allProvidersStatus() });
  });

  for (const provider of FEDERATED_PROVIDERS) {
    router.get(`/auth/${provider}/status`, (_req, res) => {
      res.json(providerStatus(provider));
    });

    router.get(`/auth/${provider}/start`, async (req, res) => {
      const status = providerStatus(provider);
      if (!status.enabled) {
        res.status(503).json({
          error: `${status.label} is not configured`,
          provider,
          hint: `Set the ${provider.toUpperCase()}_* environment variables on the backend`,
        });
        return;
      }
      const intent: AuthIntent = req.query.intent === 'signup' ? 'signup' : 'login';
      const surface = req.query.surface === 'mobile' ? 'mobile' : 'web';
      try {
        const { url } = await buildAuthorizeUrl(provider, { intent, surface });
        res.redirect(302, url);
      } catch (e) {
        res.status(502).json({
          error: e instanceof Error ? e.message : `${status.label} start failed`,
          provider,
        });
      }
    });

    router.get(`/auth/${provider}/callback`, async (req, res) => {
      const status = providerStatus(provider);
      const surfaceHint = req.query.surface === 'mobile' ? 'mobile' : 'web';
      if (!status.enabled) {
        res.redirect(302, loginErrorRedirect(provider, `${status.label} is not configured`, surfaceHint));
        return;
      }
      const err = typeof req.query.error === 'string' ? req.query.error : null;
      if (err) {
        const desc =
          typeof req.query.error_description === 'string' ? req.query.error_description : err;
        res.redirect(302, loginErrorRedirect(provider, desc, surfaceHint));
        return;
      }
      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const state = typeof req.query.state === 'string' ? req.query.state : '';
      if (!code || !state) {
        res.redirect(302, loginErrorRedirect(provider, 'missing code/state', surfaceHint));
        return;
      }
      try {
        const completed = await completeCallback(provider, { code, state });
        res.redirect(
          302,
          clientCallbackUrl({
            surface: completed.surface,
            webAppOrigin: completed.webAppOrigin,
            mobileAppOrigin: completed.mobileAppOrigin,
            exchangeCode: completed.exchangeCode,
            intent: completed.intent,
            provider: completed.provider,
          }),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : `${status.label} callback failed`;
        res.redirect(302, loginErrorRedirect(provider, msg, surfaceHint));
      }
    });

    router.post(`/auth/${provider}/exchange`, (req, res) => {
      const exchange =
        typeof (req.body as { exchange?: unknown })?.exchange === 'string'
          ? (req.body as { exchange: string }).exchange.trim()
          : '';
      if (!exchange) {
        res.status(400).json({ error: 'body.exchange is required' });
        return;
      }
      const result = consumeExchange(exchange);
      if (!result || result.provider !== provider) {
        res.status(401).json({ error: 'invalid or expired exchange code' });
        return;
      }
      emitAudit(
        store,
        {
          type: result.session.user.surface === 'mobile' ? 'manager_mobile' : 'user',
          id: result.session.user.id,
        },
        'auth.login',
        { type: 'session', id: result.session.user.id },
        {
          role: result.session.user.role,
          surface: result.session.user.surface,
          provider: result.provider,
          intent: result.intent,
        },
        [1, 2],
      );
      touch();
      res.json({ session: result.session, intent: result.intent, provider: result.provider });
    });
  }

  /** Provider-agnostic one-time exchange (web + mobile callback pages). */
  router.post('/auth/federated/exchange', (req, res) => {
    const exchange =
      typeof (req.body as { exchange?: unknown })?.exchange === 'string'
        ? (req.body as { exchange: string }).exchange.trim()
        : '';
    if (!exchange) {
      res.status(400).json({ error: 'body.exchange is required' });
      return;
    }
    const result = consumeExchange(exchange);
    if (!result) {
      res.status(401).json({ error: 'invalid or expired exchange code' });
      return;
    }
    emitAudit(
      store,
      {
        type: result.session.user.surface === 'mobile' ? 'manager_mobile' : 'user',
        id: result.session.user.id,
      },
      'auth.login',
      { type: 'session', id: result.session.user.id },
      {
        role: result.session.user.role,
        surface: result.session.user.surface,
        provider: result.provider,
        intent: result.intent,
      },
      [1, 2],
    );
    touch();
    res.json({ session: result.session, intent: result.intent, provider: result.provider });
  });

  // Validate unknown provider path early for clearer 404s under /auth/:provider/*
  router.use('/auth/:provider', (req, res, next) => {
    const provider = req.params.provider;
    if (
      provider === 'demo-users' ||
      provider === 'login' ||
      provider === 'logout' ||
      provider === 'me' ||
      provider === 'providers' ||
      provider === 'federated'
    ) {
      next();
      return;
    }
    if (typeof provider === 'string' && !isFederatedProvider(provider)) {
      res.status(404).json({ error: `unknown auth provider: ${provider}` });
      return;
    }
    next();
  });

  router.get('/auth/me', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    res.json({ user: req.auth });
  });

  // -- health ----------------------------------------------------------------
  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: '0.2.0',
      modelRunner: deps.modelRunner.kind,
      boardConnector: deps.boardConnector.kind,
    });
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

  router.patch('/work-items/:id/assignee', requireRoles('founder', 'manager'), (req, res) => {
    const item = findWorkItem(String(req.params.id));
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
      actorFromAuth(req as AuthedRequest),
      'work_item.assignee_updated',
      { type: 'work_item', id: item.id },
      { assigneeExternalId: item.assigneeExternalId, issueKey: item.board.issueKey },
      [1, 2, 3],
    );
    touch();
    res.json(item);
  });

  router.post('/work-items/:id/request-access', requireRoles('founder', 'manager'), (req, res) => {
    const item = findWorkItem(String(req.params.id));
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
      actorFromAuth(req as AuthedRequest),
      'pii.access_requested',
      { type: 'approval', id: approval.id },
      { workItemId: item.id, issueKey: item.board.issueKey },
      [1, 2, 5],
    );
    touch();
    res.status(201).json(approval);
  });

  // Manager swipe decision (mobile). aiFirst=true runs the orchestrator pipeline
  // SYNCHRONOUSLY so the response carries the job's terminal state.
  router.post('/work-items/:id/triage', requireRoles('founder', 'manager'), async (req, res) => {
    const item = findWorkItem(String(req.params.id));
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
        actorFromAuth(req as AuthedRequest),
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
        actorFromAuth(req as AuthedRequest),
        'triage.ai_first',
        { type: 'work_item', id: item.id },
        { issueKey: item.board.issueKey, targetCompletionPercent: item.targetCompletionPercent },
        [1, 2, 3],
      );
      item.aiStatus = 'queued';
      const job = createJob(store, item, policy);
      await runJobPipeline(store, job, item, policy, item.targetCompletionPercent, deps);
      response = { workItem: item, job };
    }
    touch();
    res.json(response);
  });

  // -- boards ------------------------------------------------------------------
  router.get('/boards', (_req, res) => {
    res.json(boardHealth(store));
  });

  router.post('/boards/connect', requireRoles('founder', 'manager'), async (req, res) => {
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
    try {
      await deps.boardConnector.connectProject(projectId, body.name.trim());
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'board connection failed' });
      return;
    }
    const now = new Date().toISOString();
    if (!store.boards.some((board) => board.projectId === projectId)) {
      store.boards.push({
        projectId,
        name: body.name.trim(),
        connectedAt: now,
        lastSyncAt: now,
      });
    }

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
      actorFromAuth(req as AuthedRequest),
      'board.connected',
      { type: 'board', id: projectId },
      { name: body.name.trim(), seeded: seeds.length },
      [1, 2, 3],
    );
    touch();
    res.status(201).json(boardHealth(store).find((b) => b.projectId === projectId));
  });

  router.post('/boards/:projectId/sync', requireRoles('founder', 'manager'), async (req, res) => {
    const projectId = String(req.params.projectId ?? '').toUpperCase();
    if (!projectId) {
      res.status(400).json({ error: 'projectId is required' });
      return;
    }
    const board = store.boards.find((b) => b.projectId === projectId);
    if (!board) {
      res.status(404).json({ error: `board not connected: ${projectId}` });
      return;
    }
    let syncResult: Awaited<ReturnType<OrchestratorDeps['boardConnector']['syncProject']>>;
    try {
      syncResult = await deps.boardConnector.syncProject(projectId);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'board sync failed' });
      return;
    }
    for (const issue of syncResult.issues) upsertBoardIssue(issue);
    board.lastSyncAt = new Date().toISOString();
    emitAudit(
      store,
      actorFromAuth(req as AuthedRequest),
      'board.synced',
      { type: 'board', id: projectId },
      { activeIssues: syncResult.issueCount, upsertedIssues: syncResult.issues.length },
      [1, 2, 3],
    );
    touch();
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

  router.patch('/policies/:id', requireRoles('founder', 'manager'), (req, res) => {
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
      policy.pii = mergePiiUpdate(policy.pii, body.pii);
      changed.push('pii');
    }
    if (body.customerNames !== undefined) {
      policy.customerNames = normalizeCustomerNames(body.customerNames);
      changed.push('customerNames');
    }
    if (body.cloud !== undefined) {
      const nextCloud = { ...policy.cloud, ...body.cloud };
      if (nextCloud.provider !== 'custom') {
        delete nextCloud.customLabel;
      } else if (typeof body.cloud.customLabel === 'string') {
        nextCloud.customLabel = body.cloud.customLabel.trim() || undefined;
        if (!nextCloud.customLabel) delete nextCloud.customLabel;
      }
      policy.cloud = nextCloud;
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
      actorFromAuth(req as AuthedRequest),
      'policy.updated',
      { type: 'policy', id: policy.id },
      { changed },
      [1, 2, 3, 4],
    );
    touch();
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
  router.get('/approvals', requireRoles('founder', 'manager', 'auditor'), (_req, res) => {
    res.json(store.approvals);
  });

  router.post('/approvals/:id/decision', requireRoles('founder', 'manager'), (req, res) => {
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
      actorFromAuth(req as AuthedRequest),
      `approval.${decision}`,
      { type: 'approval', id: approval.id },
      { workItemId: approval.workItemId, title: approval.title, risk: approval.risk },
      [1, 2, 4],
    );
    touch();
    res.json(approval);
  });

  // -- notifications -------------------------------------------------------------------
  router.get('/notifications', (_req, res) => {
    res.json([...store.notifications].reverse());
  });

  router.post('/notifications/:id/read', requireRoles('founder', 'manager'), (req, res) => {
    const ntf = store.notifications.find((n) => n.id === req.params.id);
    if (!ntf) {
      res.status(404).json({ error: `notification not found: ${req.params.id}` });
      return;
    }
    ntf.read = true;
    touch();
    res.json(ntf);
  });

  router.post('/notifications/read-all', requireRoles('founder', 'manager'), (_req, res) => {
    for (const n of store.notifications) n.read = true;
    touch();
    res.json({ ok: true, count: store.notifications.length });
  });

  // -- onboarding -------------------------------------------------------------------
  router.get('/onboarding', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const profile = store.onboardingByTenant[req.auth.tenantId] ?? null;
    res.json({ profile });
  });

  router.put('/onboarding', requireRoles('founder', 'manager'), (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const body = (req.body ?? {}) as Partial<OnboardingUpsertRequest>;
    if (!isOnboardingProfile(body.profile)) {
      res.status(400).json({ error: 'body.profile must be a valid OnboardingProfile' });
      return;
    }
    const now = new Date().toISOString();
    const profile: OnboardingProfile = {
      ...body.profile,
      selectedServices: [...body.profile.selectedServices],
      otherByCategory: { ...body.profile.otherByCategory },
      updatedAt: now,
      completedAt: body.profile.completedAt ?? now,
    };
    store.onboardingByTenant[req.auth.tenantId] = profile;

    const policy = orgPolicy();
    if (policy) {
      const stubs = mcpStubsFromServices(profile.selectedServices);
      if (stubs.length > 0) {
        const existing = new Set(policy.mcpAllowlist.map((e) => e.server));
        for (const stub of stubs) {
          if (!existing.has(stub.server)) policy.mcpAllowlist.push(stub);
        }
      }

      // Apply “Where AI runs” answers onto org cloud policy so jobs use the chosen account source.
      const runtime = profile.enterprise?.runtime;
      if (runtime?.hosting) {
        const mode = runtime.hosting;
        const provider =
          mode === 'public_managed'
            ? 'private'
            : runtime.cloudProvider &&
                ['aws', 'azure', 'gcp', 'nvidia', 'private', 'custom'].includes(runtime.cloudProvider)
              ? runtime.cloudProvider
              : mode === 'customer_cloud'
                ? 'aws'
                : policy.cloud.provider;
        policy.cloud = {
          ...policy.cloud,
          mode,
          provider,
          region: runtime.regions?.[0] ?? policy.cloud.region,
          ...(provider === 'custom' && runtime.customCloudLabel?.trim()
            ? { customLabel: runtime.customCloudLabel.trim() }
            : provider === 'custom'
              ? {}
              : { customLabel: undefined }),
        };
        if (provider !== 'custom') {
          delete policy.cloud.customLabel;
        }
      }
    }

    emitAudit(
      store,
      actorFromAuth(req),
      'onboarding.saved',
      { type: 'onboarding', id: req.auth.tenantId },
      {
        plan: profile.plan,
        services: profile.selectedServices.length,
        cloudMode: profile.enterprise?.runtime?.hosting,
        cloudProvider: profile.enterprise?.runtime?.cloudProvider,
      },
      [1, 2],
    );
    touch();
    res.json({ profile });
  });

  // -- MCP connections (connect providers one-by-one) ------------------------------
  router.get('/mcp/providers', (_req, res) => {
    res.json({
      providers: MCP_PROVIDERS.map((p) => ({
        ...p,
        availabilityLabel: mcpAvailabilityLabel(p.availability),
      })),
    });
  });

  router.get('/mcp/transports', (_req, res) => {
    res.json({ transports: listConfiguredTransports() });
  });

  router.get('/mcp/oauth/atlassian/status', (_req, res) => {
    res.json(getAtlassianMcpOAuthStatus());
  });

  router.get('/mcp/oauth/atlassian/start', requireRoles('founder', 'manager'), (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const started = buildAtlassianAuthorizeUrl();
    if (!started) {
      res.status(503).json({
        error: 'Atlassian MCP OAuth is not configured',
        status: getAtlassianMcpOAuthStatus(),
      });
      return;
    }
    res.json({ authorizeUrl: started.url, state: started.state });
  });

  router.get('/mcp/oauth/atlassian/callback', async (req, res) => {
    const webOrigin = process.env.WEB_APP_ORIGIN?.trim() || 'http://localhost:3000';
    const dest = new URL('/connections', webOrigin);
    const err = typeof req.query.error === 'string' ? req.query.error : null;
    if (err) {
      const desc =
        typeof req.query.error_description === 'string' ? req.query.error_description : err;
      dest.searchParams.set('atlassian_mcp', 'error');
      dest.searchParams.set('atlassian_mcp_error', desc);
      res.redirect(302, dest.toString());
      return;
    }
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code || !state) {
      dest.searchParams.set('atlassian_mcp', 'error');
      dest.searchParams.set('atlassian_mcp_error', 'missing code/state');
      res.redirect(302, dest.toString());
      return;
    }
    try {
      await completeAtlassianOAuthCallback({ code, state });
      dest.searchParams.set('atlassian_mcp', 'ok');
      res.redirect(302, dest.toString());
    } catch (e) {
      dest.searchParams.set('atlassian_mcp', 'error');
      dest.searchParams.set(
        'atlassian_mcp_error',
        e instanceof Error ? e.message : 'token exchange failed',
      );
      res.redirect(302, dest.toString());
    }
  });

  router.get('/mcp/connections', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    res.json({ connections: tenantConnections(store, req.auth.tenantId) });
  });

  router.post(
    '/mcp/connections/:serviceId',
    requireRoles('founder', 'manager'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      const serviceId = req.params.serviceId as ServiceId;
      const provider = getMcpProvider(serviceId);
      if (!provider?.connectable) {
        res.status(400).json({ error: `Service '${serviceId}' has no connectable MCP option` });
        return;
      }
      const body = (req.body ?? {}) as Partial<McpConnectRequest>;
      if (!isPermissionLevel(body.permissionLevel)) {
        res.status(400).json({ error: 'body.permissionLevel must be read | write | admin' });
        return;
      }
      const connection = createConnection(serviceId, body.permissionLevel);
      const list = tenantConnections(store, req.auth.tenantId);
      const idx = list.findIndex((c) => c.serviceId === serviceId);
      if (idx >= 0) list[idx] = connection;
      else list.push(connection);
      syncPolicyAllowlistFromConnections(store, req.auth.tenantId);
      emitAudit(
        store,
        actorFromAuth(req),
        connection.status === 'connected' ? 'mcp.connected' : 'mcp.connect_failed',
        { type: 'mcp_connection', id: serviceId },
        {
          serverId: connection.serverId,
          permissionLevel: connection.permissionLevel,
          tools: connection.grantedTools.length,
          error: connection.lastError,
        },
        [1, 2, 5],
      );
      touch();
      if (connection.status !== 'connected') {
        res.status(400).json({ connection, error: connection.lastError });
        return;
      }
      res.status(201).json({ connection });
    },
  );

  router.delete(
    '/mcp/connections/:serviceId',
    requireRoles('founder', 'manager'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      const serviceId = req.params.serviceId as ServiceId;
      const list = tenantConnections(store, req.auth.tenantId);
      const next = list.filter((c) => c.serviceId !== serviceId);
      store.mcpConnectionsByTenant[req.auth.tenantId] = next;
      emitAudit(
        store,
        actorFromAuth(req),
        'mcp.disconnected',
        { type: 'mcp_connection', id: serviceId },
        {},
        [1, 2],
      );
      touch();
      res.json({ ok: true });
    },
  );

  router.post(
    '/mcp/connections/:serviceId/tools/:tool',
    requireRoles('founder', 'manager'),
    async (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      const serviceId = req.params.serviceId as ServiceId;
      const tool = req.params.tool!;
      const connection = tenantConnections(store, req.auth.tenantId).find(
        (c) => c.serviceId === serviceId,
      );
      if (!connection) {
        res.status(404).json({ error: 'connection not found — connect the provider first' });
        return;
      }
      const result = await callToolAsync(
        connection,
        tool,
        (req.body ?? {}) as Record<string, unknown>,
      );
      emitAudit(
        store,
        actorFromAuth(req),
        result.ok ? 'mcp.tool_called' : 'mcp.tool_denied',
        { type: 'mcp_connection', id: serviceId },
        {
          tool,
          ok: result.ok,
          bytes: result.bytes,
          error: result.error,
          transport: result.transport,
        },
        [1, 2, 5],
      );
      touch();
      res.status(result.ok ? 200 : 403).json({ result });
    },
  );

  return router;
}
