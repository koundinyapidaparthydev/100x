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
  ApproveCallSetRequest,
  BoardConnectRequest,
  BoardHealth,
  CreateAccessKeyRequest,
  CreateCallSetRequest,
  CreateCustomModelRequest,
  CreateCustomRoleRequest,
  CreateEnvironmentRequest,
  CreateIdentityGroupRequest,
  CreatePasskeyRequest,
  CreateSkillPackRequest,
  DashboardStats,
  EnsureEnvironmentsRequest,
  FederatedAuthProvider,
  IamImportRequest,
  LinkSolutionsRequest,
  LoginRequest,
  McpAllowlistEntry,
  McpConnectRequest,
  MergeCallSetRequest,
  OnboardingProfile,
  OnboardingUpsertRequest,
  PolicyUpdate,
  ServiceId,
  ServiceMcpConnection,
  SetActiveEnvironmentRequest,
  TriageRequest,
  TriageResponse,
  UpdateCustomRoleRequest,
  UpdateHomeLayoutRequest,
  UpdateIdentityGroupRequest,
  UpdateSecuritySettingsRequest,
  UpdateTenantUserRequest,
  UpdateUserEnvironmentGrantsRequest,
  WorkItem,
  WorkItemAssigneeUpdate,
  WorkspaceSetupRequest,
} from '../../shared/types';
import {
  actorFromAuth,
  demoAuthEnabled,
  issueFederatedSession,
  issueSession,
  listDemoUsers,
  requirePlatform,
  revokeSession,
  type AuthedRequest,
} from './auth';
import {
  createEnvironment,
  ensureEnvironmentsFromRequest,
  listEnvironmentsForUser,
  resolveActiveEnvironmentId,
  setActiveEnvironment,
} from './environments';
import {
  archiveCustomModel,
  archiveSkillPack,
  createCustomModel,
  createSkillPack,
  exportSkillPack,
  linkSolutionsToModel,
  linkSolutionsToSkill,
  listCustomModels,
  listSkillPacks,
  publishSkillPack,
  submitSkillForReview,
  trainCustomModel,
} from './learning';
import {
  approveCallSet,
  archiveSolution,
  createCallSet,
  listCallSets,
  listSolutions,
  mergeCallSet,
  promoteCallSet,
  rejectCallSet,
} from './solutions';
import {
  completeWorkspaceSetup,
  createGroup,
  createIamImportJob,
  deleteGroup,
  enrichAuthUser,
  createCustomRole,
  deleteCustomRole,
  getUserEnvironmentGrants,
  listCustomRoles,
  roleMcpLevel,
  setUserEnvironmentGrants,
  updateCustomRole,
  listConsoleServices,
  listGroups,
  listIamImportJobs,
  listTenantUsers,
  updateGroup,
  updateTenantUser,
  upsertTenantUserFromAuth,
  userCanAccessEnvironment,
} from './identity';
import {
  createInvite,
  listInvites,
  resolveAccessForFederatedUser,
  resendInvite,
  revokeInvite,
} from './invites';
import {
  createAccessKey,
  getSecuritySettings,
  registerPasskey,
  revokeAccessKey,
  revokePasskey,
  updateSecuritySettings,
} from './security';
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
import {
  credentialsStatus,
  isIamService,
  precheckConnect,
  setAtlassianCredentials,
  setGithubCredentials,
  setIamCredentials,
  setProviderOAuthCredentials,
  setServiceToken,
} from './mcp/credentials';
import {
  buildProviderAuthorizeUrl,
  completeProviderOAuthCallback,
  getProviderOAuthStatus,
  isProviderOAuthFamily,
  listProviderOAuthStatuses,
  type ProviderOAuthFamily,
} from './mcp/providerOAuth';
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
import {
  effectivePolicy,
  ENV_ONLY_POLICY_FIELDS,
  envPolicyRow,
  isOrgBasePolicy,
  ORG_ONLY_POLICY_FIELDS,
  orgBasePolicy,
} from './policyResolve';
import { emitAudit, nextId, type Store, TENANT_ID } from './store';

const PERMISSION_LEVELS: McpPermissionLevel[] = ['read', 'write', 'admin'];

function isPermissionLevel(value: unknown): value is McpPermissionLevel {
  return typeof value === 'string' && (PERMISSION_LEVELS as string[]).includes(value);
}

function tenantConnections(
  store: Store,
  tenantId: string,
  environmentId?: string,
): ServiceMcpConnection[] {
  if (!store.mcpConnectionsByTenant[tenantId]) {
    store.mcpConnectionsByTenant[tenantId] = [];
  }
  const all = store.mcpConnectionsByTenant[tenantId]!;
  if (!environmentId) return all;
  return all.filter((c) => c.environmentId === environmentId);
}

function syncPolicyAllowlistFromConnections(
  store: Store,
  tenantId: string,
  environmentId?: string,
): void {
  const envId = environmentId ?? resolveActiveEnvironmentId(store, tenantId);
  const policy = envPolicyRow(store, envId, tenantId);
  if (!policy) return;
  const fromConn = allowlistEntriesFromConnections(
    tenantConnections(store, tenantId, envId),
  );
  if (fromConn.length === 0) return;
  const byServer = new Map(policy.mcpAllowlist.map((e) => [e.server, e]));
  for (const entry of fromConn) {
    byServer.set(entry.server, entry);
  }
  policy.mcpAllowlist = [...byServer.values()];
}

const MS_24H = 24 * 3_600_000;

/** Built-in seed tickets + seed-demo-queue DEMO board — not real user work. */
function isSandboxDemoWorkItem(item: WorkItem): boolean {
  const projectId = item.board.projectId.toUpperCase();
  const issueKey = item.board.issueKey.toUpperCase();
  if (projectId === 'DEMO' || issueKey.startsWith('DEMO-')) return true;
  if (/^wi-(100x|infra|fe)-\d+$/i.test(item.id)) return true;
  if (/^demo queue top-up/i.test(item.title)) return true;
  return false;
}

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
  const activeEnvPolicy = (tenantId = TENANT_ID) => {
    const envId = resolveActiveEnvironmentId(store, tenantId);
    return effectivePolicy(store, envId, tenantId);
  };
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
      targetCompletionPercent: orgBasePolicy(store)?.targetCompletionPercentDefault ?? 20,
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
    res.json(
      listDemoUsers().map(({ id, displayName, email, roleId, isWorkspaceOwner }) => ({
        id,
        displayName,
        email,
        roleId,
        isWorkspaceOwner: isWorkspaceOwner === true,
      })),
    );
  });

  router.post('/auth/login', (req, res) => {
    const body = (req.body ?? {}) as Partial<LoginRequest>;
    if (typeof body.identity !== 'string' || !body.identity.trim()) {
      res.status(400).json({
        error: 'body.identity is required (owner|root|member|engineer or email)',
      });
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
    upsertTenantUserFromAuth(store, session.user, { fromInvite: false });
    emitAudit(
      store,
      { type: session.user.surface === 'mobile' ? 'manager_mobile' : 'user', id: session.user.id },
      'auth.login',
      { type: 'session', id: session.user.id },
      {
        roleId: session.user.roleId,
        isWorkspaceOwner: session.user.isWorkspaceOwner === true,
        surface: session.user.surface,
      },
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
        const completed = await completeCallback(
          provider,
          { code, state },
          {
            adjustUser: (user, intent) => resolveAccessForFederatedUser(store, user, intent),
          },
        );
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
          roleId: result.session.user.roleId,
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
        roleId: result.session.user.roleId,
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
    // Ensure demo seats appear in the directory; federated users are upserted at SSO time.
    if (req.auth.id.startsWith('usr-')) {
      upsertTenantUserFromAuth(store, { ...req.auth, workspaceSetupComplete: true }, { fromInvite: false });
    }
    res.json({ user: enrichAuthUser(store, req.auth) });
  });

  // -- health ----------------------------------------------------------------
  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: '0.2.0',
      modelRunner: deps.modelRunner.kind,
      modelProviders: deps.modelRunner.configuredProviders ?? [],
      boardConnector: deps.boardConnector.kind,
    });
  });

  // -- work items --------------------------------------------------------------
  router.get('/work-items', (req: AuthedRequest, res) => {
    const { aiStatus, aiFirst, projectId, triagePending } = req.query;
    let items = store.workItems;
    // Hide sandbox DEMO / built-in seed cards for every session (demo + SSO).
    // Real boards still show after connect/sync. Opt back into the seed deck with
    // INCLUDE_SANDBOX_WORK_ITEMS=1 (e2e / local swipe demos).
    if (process.env.INCLUDE_SANDBOX_WORK_ITEMS !== '1') {
      items = items.filter((w) => !isSandboxDemoWorkItem(w));
    }
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

  router.patch('/work-items/:id/assignee', requirePlatform(store, 'work_items.triage'), (req, res) => {
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

  router.post('/work-items/:id/request-access', requirePlatform(store, 'work_items.triage'), (req, res) => {
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
  router.post('/work-items/:id/triage', requirePlatform(store, 'work_items.triage'), async (req, res) => {
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
    const policy = activeEnvPolicy();
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

  router.post('/boards/connect', requirePlatform(store, 'boards.connect'), async (req, res) => {
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
        targetCompletionPercent: orgBasePolicy(store)?.targetCompletionPercentDefault ?? 20,
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

  router.post('/boards/:projectId/sync', requirePlatform(store, 'boards.connect'), async (req, res) => {
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
  router.get('/policies', (req, res) => {
    const environmentId =
      typeof req.query.environmentId === 'string' ? req.query.environmentId.trim() : '';
    if (environmentId === 'org' || environmentId === 'null') {
      res.json(store.policies.filter((p) => p.environmentId == null));
      return;
    }
    if (environmentId) {
      res.json(store.policies.filter((p) => p.environmentId === environmentId));
      return;
    }
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

  router.patch('/policies/:id', requirePlatform(store, 'policies.manage'), (req: AuthedRequest, res) => {
    if (req.auth?.surface === 'mobile') {
      res.status(403).json({
        error: 'Policy edits are web-only. Use Governance on the web console.',
      });
      return;
    }
    const policy = store.policies.find((p) => p.id === req.params.id);
    if (!policy) {
      res.status(404).json({ error: `policy not found: ${req.params.id}` });
      return;
    }
    const body = (req.body ?? {}) as PolicyUpdate;
    const changed: string[] = [];
    const orgBase = isOrgBasePolicy(policy);
    const rejected: string[] = [];

    const bodyKeys = Object.keys(body) as Array<keyof PolicyUpdate>;
    for (const key of bodyKeys) {
      if (body[key] === undefined) continue;
      if (orgBase && (ENV_ONLY_POLICY_FIELDS as readonly string[]).includes(key)) {
        rejected.push(key);
      }
      if (!orgBase && (ORG_ONLY_POLICY_FIELDS as readonly string[]).includes(key)) {
        rejected.push(key);
      }
    }
    if (rejected.length > 0) {
      res.status(400).json({
        error: orgBase
          ? `Org base policy only accepts org-wide fields; refused: ${rejected.join(', ')}. Edit PII/runtime on the environment policy.`
          : `Environment policy only accepts per-env fields; refused: ${rejected.join(', ')}. Edit budgets/AI defaults on the org base policy.`,
        refused: rejected,
      });
      return;
    }

    if (orgBase) {
      if (body.securityLevel !== undefined) {
        policy.securityLevel = body.securityLevel;
        changed.push('securityLevel');
      }
      if (body.tokenBudget !== undefined) {
        policy.tokenBudget = { ...policy.tokenBudget, ...body.tokenBudget };
        changed.push('tokenBudget');
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
    } else {
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
      if (body.mcpAllowlist !== undefined) {
        policy.mcpAllowlist = body.mcpAllowlist;
        changed.push('mcpAllowlist');
      }
    }

    if (changed.length === 0) {
      res.status(400).json({ error: 'no recognized policy fields to update' });
      return;
    }

    emitAudit(
      store,
      actorFromAuth(req),
      'policy.updated',
      { type: 'policy', id: policy.id },
      { changed, environmentId: policy.environmentId },
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
    const policy = orgBasePolicy(store) ?? activeEnvPolicy();
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
  router.get('/approvals', requirePlatform(store, 'approvals.read'), (_req, res) => {
    res.json(store.approvals);
  });

  router.post('/approvals/:id/decision', requirePlatform(store, 'approvals.decide'), (req, res) => {
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

  router.post('/notifications/:id/read', requirePlatform(store, 'notifications.manage'), (req, res) => {
    const ntf = store.notifications.find((n) => n.id === req.params.id);
    if (!ntf) {
      res.status(404).json({ error: `notification not found: ${req.params.id}` });
      return;
    }
    ntf.read = true;
    touch();
    res.json(ntf);
  });

  router.post('/notifications/read-all', requirePlatform(store, 'notifications.manage'), (_req, res) => {
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
    const profile = store.onboardingByUser[req.auth.id] ?? null;
    res.json({ profile });
  });

  router.put('/onboarding', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    // Every signed-in user must be able to save their own completion profile.
    // Google/Apple login defaults to engineer; blocking PUT left them stuck on /onboarding.
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
      // Honor explicit null so clients/e2e can reset completion; only default when omitted.
      completedAt:
        body.profile.completedAt === undefined ? now : body.profile.completedAt,
    };
    store.onboardingByUser[req.auth.id] = profile;

    const envId = resolveActiveEnvironmentId(store, req.auth.tenantId);
    const policy = envPolicyRow(store, envId, req.auth.tenantId) ?? activeEnvPolicy(req.auth.tenantId);
    if (policy) {
      const stubs = mcpStubsFromServices(profile.selectedServices);
      if (stubs.length > 0) {
        const existing = new Set(policy.mcpAllowlist.map((e) => e.server));
        for (const stub of stubs) {
          if (!existing.has(stub.server)) policy.mcpAllowlist.push(stub);
        }
      }

      // Apply “Where AI runs” answers onto the active environment’s cloud policy.
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
      { type: 'onboarding', id: req.auth.id },
      {
        plan: profile.plan,
        services: profile.selectedServices.length,
        cloudMode: profile.enterprise?.runtime?.hosting,
        cloudProvider: profile.enterprise?.runtime?.cloudProvider,
        tenantId: req.auth.tenantId,
      },
      [1, 2],
    );
    touch();
    res.json({ profile });
  });

  // -- workspace invites (root provisions users by email; SendGrid or stub) ------
  router.get('/invites', requirePlatform(store, 'invites.manage'), (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    res.json({ invites: listInvites(store, req.auth.tenantId) });
  });

  router.post('/invites', requirePlatform(store, 'invites.manage'), async (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const body = (req.body ?? {}) as { email?: unknown; roleId?: unknown };
    const email = typeof body.email === 'string' ? body.email : '';
    const roleId = typeof body.roleId === 'string' ? body.roleId : '';
    if (!roleId) {
      res.status(400).json({ error: 'body.roleId is required (custom role id)' });
      return;
    }
    try {
      const result = await createInvite(store, req.auth, { email, roleId });
      emitAudit(
        store,
        actorFromAuth(req),
        'invite.created',
        { type: 'invite', id: result.invite.id },
        {
          email: result.invite.email,
          roleId: result.invite.roleId,
          emailChannel: result.emailDelivery.channel,
          emailMessageId: result.emailDelivery.messageId ?? null,
        },
        [1, 2],
      );
      touch();
      res.status(201).json(result);
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.post('/invites/:id/resend', requirePlatform(store, 'invites.manage'), async (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const inviteId = String(req.params.id ?? '');
    try {
      const result = await resendInvite(store, req.auth, inviteId);
      emitAudit(
        store,
        actorFromAuth(req),
        'invite.resent',
        { type: 'invite', id: result.invite.id },
        {
          email: result.invite.email,
          emailChannel: result.emailDelivery.channel,
          emailMessageId: result.emailDelivery.messageId ?? null,
        },
        [1, 2],
      );
      touch();
      res.json(result);
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.post('/invites/:id/revoke', requirePlatform(store, 'invites.manage'), (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const inviteId = String(req.params.id ?? '');
    try {
      const invite = revokeInvite(store, req.auth, inviteId);
      emitAudit(
        store,
        actorFromAuth(req),
        'invite.revoked',
        { type: 'invite', id: invite.id },
        { email: invite.email },
        [1, 2],
      );
      touch();
      res.json({ invite });
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  // -- workspace identity (users / roles / groups / services / IAM import) ---------
  function remintSession(user: import('../../shared/types').AuthUser) {
    const prefix = user.id.includes(':') ? user.id.split(':')[0]! : 'google';
    const federatedProviders: FederatedAuthProvider[] = [
      'okta',
      'entra',
      'google_workspace',
      'google',
      'apple',
    ];
    const provider = (federatedProviders as string[]).includes(prefix)
      ? (prefix as FederatedAuthProvider)
      : 'google';
    return issueFederatedSession(user, provider);
  }

  router.get('/workspace/setup', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const user = enrichAuthUser(store, req.auth);
    res.json({
      user,
      complete: user.workspaceSetupComplete === true,
    });
  });

  router.put('/workspace/setup', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const body = (req.body ?? {}) as WorkspaceSetupRequest;
    try {
      // Directory must exist (SSO upsert or demo seed).
      upsertTenantUserFromAuth(store, req.auth, {
        isNewSignup: req.auth.isWorkspaceOwner === true && req.auth.workspaceSetupComplete !== true,
      });
      const user = completeWorkspaceSetup(store, req.auth, {
        isPrimaryGoogleAccount: body.isPrimaryGoogleAccount !== false,
        companyDomain: typeof body.companyDomain === 'string' ? body.companyDomain : undefined,
        companyWebsite: typeof body.companyWebsite === 'string' ? body.companyWebsite : undefined,
        workEmail: typeof body.workEmail === 'string' ? body.workEmail : undefined,
        belongsToParentCompany: body.belongsToParentCompany === true,
        parentCompanyDomain:
          typeof body.parentCompanyDomain === 'string' ? body.parentCompanyDomain : undefined,
      });
      const session = remintSession(user);
      emitAudit(
        store,
        actorFromAuth(req),
        'workspace.setup_completed',
        { type: 'user', id: user.id },
        {
          companyDomain: user.companyDomain ?? null,
          isWorkspaceOwner: user.isWorkspaceOwner === true,
          belongsToParentCompany: body.belongsToParentCompany === true,
        },
        [1, 2],
      );
      touch();
      res.json({ user: session.user, session });
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  // -- workspace environments -----------------------------------------------------
  router.get('/environments', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const state = listEnvironmentsForUser(store, req.auth);
    touch();
    res.json(state);
  });

  router.put('/environments/active', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const body = (req.body ?? {}) as SetActiveEnvironmentRequest;
    if (typeof body.environmentId !== 'string' || !body.environmentId.trim()) {
      res.status(400).json({ error: 'body.environmentId is required' });
      return;
    }
    try {
      const state = setActiveEnvironment(
        store,
        req.auth.tenantId,
        body.environmentId.trim(),
        req.auth,
      );
      emitAudit(
        store,
        actorFromAuth(req),
        'environment.active_set',
        { type: 'environment', id: state.activeEnvironmentId },
        { environmentId: state.activeEnvironmentId },
        [1, 2],
      );
      touch();
      res.json(state);
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.post('/environments', requirePlatform(store, 'environments.manage'), (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const body = (req.body ?? {}) as CreateEnvironmentRequest;
    try {
      const { state, environment } = createEnvironment(store, req.auth.tenantId, {
        key: typeof body.key === 'string' ? body.key : '',
        name: typeof body.name === 'string' ? body.name : '',
      });
      emitAudit(
        store,
        actorFromAuth(req),
        'environment.created',
        { type: 'environment', id: environment.id },
        { key: environment.key, name: environment.name },
        [1, 2],
      );
      touch();
      res.status(201).json(state);
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.post('/environments/ensure', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const body = (req.body ?? {}) as EnsureEnvironmentsRequest;
    try {
      ensureEnvironmentsFromRequest(store, req.auth.tenantId, {
        keys: Array.isArray(body.keys) ? body.keys.map(String) : [],
      });
      const state = listEnvironmentsForUser(store, req.auth);
      emitAudit(
        store,
        actorFromAuth(req),
        'environment.ensured',
        { type: 'tenant', id: req.auth.tenantId },
        { keys: body.keys, count: state.environments.length },
        [1, 2],
      );
      touch();
      res.json(state);
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  // -- solutions / learning (custom models + skills) ------------------------------
  // Source: docs/ai/SOLUTIONS.md, docs/ai/MODELS_AND_SKILLS.md
  router.get('/call-sets', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    touch();
    res.json({ callSets: listCallSets(store, req.auth.tenantId) });
  });

  router.post('/call-sets', requirePlatform(store, 'solutions.manage'), (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const body = (req.body ?? {}) as CreateCallSetRequest;
    try {
      const callSet = createCallSet(store, body, req.auth.tenantId);
      emitAudit(
        store,
        actorFromAuth(req),
        'call_set.created',
        { type: 'call_set', id: callSet.id },
        { workItemId: callSet.workItemId },
        [1, 2, 3],
      );
      touch();
      res.status(201).json(callSet);
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.post(
    '/call-sets/:id/approve',
    requirePlatform(store, 'solutions.manage'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      const body = (req.body ?? {}) as ApproveCallSetRequest;
      try {
        const callSet = approveCallSet(store, String(req.params.id), body, req.auth.id, req.auth.tenantId);
        emitAudit(
          store,
          actorFromAuth(req),
          'call_set.approved',
          { type: 'call_set', id: callSet.id },
          { approvedBy: callSet.approvedBy },
          [1, 2, 3],
        );
        touch();
        res.json(callSet);
      } catch (e) {
        const err = e as Error & { status?: number };
        res.status(err.status ?? 500).json({ error: err.message });
      }
    },
  );

  router.post(
    '/call-sets/:id/merge',
    requirePlatform(store, 'solutions.manage'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      const body = (req.body ?? {}) as MergeCallSetRequest;
      try {
        const callSet = mergeCallSet(store, String(req.params.id), body, req.auth.tenantId);
        emitAudit(
          store,
          actorFromAuth(req),
          'call_set.merged',
          { type: 'call_set', id: callSet.id },
          { mergeRef: callSet.mergeRef },
          [1, 2, 3],
        );
        touch();
        res.json(callSet);
      } catch (e) {
        const err = e as Error & { status?: number };
        res.status(err.status ?? 500).json({ error: err.message });
      }
    },
  );

  router.post(
    '/call-sets/:id/reject',
    requirePlatform(store, 'solutions.manage'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      try {
        const callSet = rejectCallSet(store, String(req.params.id), req.auth.tenantId);
        emitAudit(
          store,
          actorFromAuth(req),
          'call_set.rejected',
          { type: 'call_set', id: callSet.id },
          {},
          [1, 2, 3],
        );
        touch();
        res.json(callSet);
      } catch (e) {
        const err = e as Error & { status?: number };
        res.status(err.status ?? 500).json({ error: err.message });
      }
    },
  );

  router.post(
    '/call-sets/:id/promote',
    requirePlatform(store, 'solutions.manage'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      try {
        const result = promoteCallSet(store, String(req.params.id), actorFromAuth(req), req.auth.tenantId);
        touch();
        res.status(201).json(result);
      } catch (e) {
        const err = e as Error & { status?: number };
        res.status(err.status ?? 500).json({ error: err.message });
      }
    },
  );

  router.get('/solutions', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    touch();
    res.json({ solutions: listSolutions(store, req.auth.tenantId) });
  });

  router.post(
    '/solutions/:id/archive',
    requirePlatform(store, 'solutions.manage'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      try {
        const solution = archiveSolution(store, String(req.params.id), req.auth.tenantId);
        emitAudit(
          store,
          actorFromAuth(req),
          'solution.archived',
          { type: 'solution', id: solution.id },
          {},
          [1, 2],
        );
        touch();
        res.json(solution);
      } catch (e) {
        const err = e as Error & { status?: number };
        res.status(err.status ?? 500).json({ error: err.message });
      }
    },
  );

  router.get('/custom-models', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    touch();
    res.json({ models: listCustomModels(store, req.auth.tenantId) });
  });

  router.post(
    '/custom-models',
    requirePlatform(store, 'learning.manage'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      const body = (req.body ?? {}) as CreateCustomModelRequest;
      try {
        const model = createCustomModel(store, body, req.auth.tenantId);
        emitAudit(
          store,
          actorFromAuth(req),
          'custom_model.created',
          { type: 'custom_model', id: model.id },
          { name: model.name, solutionCount: model.solutionIds.length },
          [1, 2, 3],
        );
        touch();
        res.status(201).json(model);
      } catch (e) {
        const err = e as Error & { status?: number };
        res.status(err.status ?? 500).json({ error: err.message });
      }
    },
  );

  router.post(
    '/custom-models/:id/link-solutions',
    requirePlatform(store, 'learning.manage'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      const body = (req.body ?? {}) as LinkSolutionsRequest;
      try {
        const model = linkSolutionsToModel(store, String(req.params.id), body, req.auth.tenantId);
        touch();
        res.json(model);
      } catch (e) {
        const err = e as Error & { status?: number };
        res.status(err.status ?? 500).json({ error: err.message });
      }
    },
  );

  router.post(
    '/custom-models/:id/train',
    requirePlatform(store, 'learning.manage'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      try {
        const model = trainCustomModel(store, String(req.params.id), actorFromAuth(req), req.auth.tenantId);
        touch();
        res.json(model);
      } catch (e) {
        const err = e as Error & { status?: number };
        res.status(err.status ?? 500).json({ error: err.message });
      }
    },
  );

  router.post(
    '/custom-models/:id/archive',
    requirePlatform(store, 'learning.manage'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      try {
        const model = archiveCustomModel(store, String(req.params.id), req.auth.tenantId);
        touch();
        res.json(model);
      } catch (e) {
        const err = e as Error & { status?: number };
        res.status(err.status ?? 500).json({ error: err.message });
      }
    },
  );

  router.get('/skill-packs', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    touch();
    res.json({ skillPacks: listSkillPacks(store, req.auth.tenantId) });
  });

  router.post(
    '/skill-packs',
    requirePlatform(store, 'learning.manage'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      const body = (req.body ?? {}) as CreateSkillPackRequest;
      try {
        const pack = createSkillPack(store, body, req.auth.tenantId);
        emitAudit(
          store,
          actorFromAuth(req),
          'skill_pack.created',
          { type: 'skill_pack', id: pack.id },
          { category: pack.category },
          [1, 2, 3],
        );
        touch();
        res.status(201).json(pack);
      } catch (e) {
        const err = e as Error & { status?: number };
        res.status(err.status ?? 500).json({ error: err.message });
      }
    },
  );

  router.post(
    '/skill-packs/:id/link-solutions',
    requirePlatform(store, 'learning.manage'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      const body = (req.body ?? {}) as LinkSolutionsRequest;
      try {
        const pack = linkSolutionsToSkill(store, String(req.params.id), body, req.auth.tenantId);
        touch();
        res.json(pack);
      } catch (e) {
        const err = e as Error & { status?: number };
        res.status(err.status ?? 500).json({ error: err.message });
      }
    },
  );

  router.post(
    '/skill-packs/:id/submit-review',
    requirePlatform(store, 'learning.manage'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      try {
        const pack = submitSkillForReview(store, String(req.params.id), req.auth.tenantId);
        touch();
        res.json(pack);
      } catch (e) {
        const err = e as Error & { status?: number };
        res.status(err.status ?? 500).json({ error: err.message });
      }
    },
  );

  router.post(
    '/skill-packs/:id/publish',
    requirePlatform(store, 'learning.manage'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      try {
        const pack = publishSkillPack(store, String(req.params.id), actorFromAuth(req), req.auth.tenantId);
        touch();
        res.json(pack);
      } catch (e) {
        const err = e as Error & { status?: number };
        res.status(err.status ?? 500).json({ error: err.message });
      }
    },
  );

  router.get('/skill-packs/:id/export', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    try {
      const exported = exportSkillPack(store, String(req.params.id), req.auth.tenantId);
      touch();
      res.json(exported);
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.post(
    '/skill-packs/:id/archive',
    requirePlatform(store, 'learning.manage'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      try {
        const pack = archiveSkillPack(store, String(req.params.id), req.auth.tenantId);
        touch();
        res.json(pack);
      } catch (e) {
        const err = e as Error & { status?: number };
        res.status(err.status ?? 500).json({ error: err.message });
      }
    },
  );

  // -- account security (2FA / passkeys / access keys — sandbox stubs) -------------
  router.get('/security', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const settings = getSecuritySettings(store, req.auth);
    touch();
    res.json({ settings });
  });

  router.put('/security', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const body = (req.body ?? {}) as UpdateSecuritySettingsRequest;
    try {
      const settings = updateSecuritySettings(store, req.auth, body);
      emitAudit(
        store,
        actorFromAuth(req),
        'security.settings_updated',
        { type: 'user', id: req.auth.id },
        {
          twoFactorEnabled: settings.twoFactorEnabled,
          twoFactorRequired: settings.twoFactorRequired,
          passkeysEnabled: settings.passkeysEnabled,
        },
        [1, 2],
      );
      touch();
      res.json({ settings });
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.post('/security/passkeys', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const body = (req.body ?? {}) as CreatePasskeyRequest;
    try {
      const settings = registerPasskey(store, req.auth, {
        name: typeof body.name === 'string' ? body.name : '',
      });
      emitAudit(
        store,
        actorFromAuth(req),
        'security.passkey_registered',
        { type: 'user', id: req.auth.id },
        { name: body.name },
        [1, 2],
      );
      touch();
      res.status(201).json({ settings });
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.delete('/security/passkeys/:id', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    try {
      const settings = revokePasskey(store, req.auth, String(req.params.id ?? ''));
      emitAudit(
        store,
        actorFromAuth(req),
        'security.passkey_revoked',
        { type: 'user', id: req.auth.id },
        { passkeyId: req.params.id },
        [1, 2],
      );
      touch();
      res.json({ settings });
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.post('/security/access-keys', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const body = (req.body ?? {}) as CreateAccessKeyRequest;
    try {
      const result = createAccessKey(store, req.auth, {
        name: typeof body.name === 'string' ? body.name : '',
      });
      emitAudit(
        store,
        actorFromAuth(req),
        'security.access_key_created',
        { type: 'user', id: req.auth.id },
        { keyId: result.key.id, name: result.key.name },
        [1, 2],
      );
      touch();
      res.status(201).json(result);
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.post('/security/access-keys/:id/revoke', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    try {
      const settings = revokeAccessKey(store, req.auth, String(req.params.id ?? ''));
      emitAudit(
        store,
        actorFromAuth(req),
        'security.access_key_revoked',
        { type: 'user', id: req.auth.id },
        { keyId: req.params.id },
        [1, 2],
      );
      touch();
      res.json({ settings });
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  // -- workspace identity ---------------------------------------------------------
  router.get('/identity/users', requirePlatform(store, 'identity.manage'), (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    res.json({ users: listTenantUsers(store, req.auth.tenantId) });
  });

  router.patch('/identity/users/:id', requirePlatform(store, 'identity.manage'), (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const body = (req.body ?? {}) as UpdateTenantUserRequest;
    try {
      const user = updateTenantUser(store, req.auth, String(req.params.id ?? ''), body);
      const grants = getUserEnvironmentGrants(store, req.auth.tenantId, user.id);
      emitAudit(
        store,
        actorFromAuth(req),
        'identity.user_updated',
        { type: 'user', id: user.id },
        { roleId: user.roleId, groupIds: user.groupIds },
        [1, 2],
      );
      touch();
      res.json({ user: { ...user, environmentGrants: grants } });
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.get(
    '/identity/users/:id/environments',
    requirePlatform(store, 'identity.manage'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      const userId = String(req.params.id ?? '');
      const user = listTenantUsers(store, req.auth.tenantId).find((u) => u.id === userId);
      if (!user) {
        res.status(404).json({ error: 'user not found' });
        return;
      }
      res.json({
        userId,
        grants: getUserEnvironmentGrants(store, req.auth.tenantId, userId),
      });
    },
  );

  router.put(
    '/identity/users/:id/environments',
    requirePlatform(store, 'identity.manage'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      const body = (req.body ?? {}) as UpdateUserEnvironmentGrantsRequest;
      const grantsInput = Array.isArray(body.grants) ? body.grants : null;
      if (!grantsInput) {
        res.status(400).json({ error: 'body.grants must be an array' });
        return;
      }
      try {
        const grants = setUserEnvironmentGrants(
          store,
          req.auth,
          String(req.params.id ?? ''),
          grantsInput,
        );
        emitAudit(
          store,
          actorFromAuth(req),
          'identity.user_environments_updated',
          { type: 'user', id: String(req.params.id ?? '') },
          { grantCount: grants.length },
          [1, 2],
        );
        touch();
        res.json({ userId: String(req.params.id ?? ''), grants });
      } catch (e) {
        const err = e as Error & { status?: number };
        res.status(err.status ?? 500).json({ error: err.message });
      }
    },
  );

  router.get('/identity/roles', requirePlatform(store, 'identity.read'), (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    res.json({ roles: listCustomRoles(store, req.auth.tenantId) });
  });

  router.post('/identity/roles', requirePlatform(store, 'identity.manage'), (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    try {
      const role = createCustomRole(store, req.auth, (req.body ?? {}) as CreateCustomRoleRequest);
      emitAudit(
        store,
        actorFromAuth(req),
        'identity.role_created',
        { type: 'role', id: role.id },
        { name: role.name, ruleCount: role.rules.length },
        [1, 2],
      );
      touch();
      res.status(201).json({ role });
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.patch('/identity/roles/:id', requirePlatform(store, 'identity.manage'), (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    try {
      const role = updateCustomRole(
        store,
        req.auth,
        String(req.params.id ?? ''),
        (req.body ?? {}) as UpdateCustomRoleRequest,
      );
      emitAudit(
        store,
        actorFromAuth(req),
        'identity.role_updated',
        { type: 'role', id: role.id },
        { name: role.name, ruleCount: role.rules.length },
        [1, 2],
      );
      touch();
      res.json({ role });
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.delete('/identity/roles/:id', requirePlatform(store, 'identity.manage'), (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    try {
      const roleId = String(req.params.id ?? '');
      deleteCustomRole(store, req.auth, roleId);
      emitAudit(
        store,
        actorFromAuth(req),
        'identity.role_deleted',
        { type: 'role', id: roleId },
        {},
        [1, 2],
      );
      touch();
      res.status(204).send();
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.get('/identity/groups', requirePlatform(store, 'identity.read'), (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    res.json({ groups: listGroups(store, req.auth.tenantId) });
  });

  router.post('/identity/groups', requirePlatform(store, 'identity.manage'), (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const body = (req.body ?? {}) as CreateIdentityGroupRequest;
    try {
      const group = createGroup(store, req.auth, body);
      emitAudit(
        store,
        actorFromAuth(req),
        'identity.group_created',
        { type: 'group', id: group.id },
        { name: group.name },
        [1, 2],
      );
      touch();
      res.status(201).json({ group });
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.patch('/identity/groups/:id', requirePlatform(store, 'identity.manage'), (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const body = (req.body ?? {}) as UpdateIdentityGroupRequest;
    try {
      const group = updateGroup(store, req.auth, String(req.params.id ?? ''), body);
      emitAudit(
        store,
        actorFromAuth(req),
        'identity.group_updated',
        { type: 'group', id: group.id },
        { name: group.name, memberCount: group.memberIds.length },
        [1, 2],
      );
      touch();
      res.json({ group });
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.delete('/identity/groups/:id', requirePlatform(store, 'groups.delete'), (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    try {
      const groupId = String(req.params.id ?? '');
      deleteGroup(store, req.auth, groupId);
      emitAudit(
        store,
        actorFromAuth(req),
        'identity.group_deleted',
        { type: 'group', id: groupId },
        {},
        [1, 2],
      );
      touch();
      res.status(204).send();
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  });

  router.get('/identity/services', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const envId = resolveActiveEnvironmentId(store, req.auth.tenantId);
    res.json({ services: listConsoleServices(store, req.auth.tenantId, envId) });
  });

  router.get('/identity/iam-imports', requirePlatform(store, 'identity.manage'), (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    res.json({ jobs: listIamImportJobs(store, req.auth.tenantId) });
  });

  router.post('/identity/iam-imports', requirePlatform(store, 'identity.manage'), (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const body = (req.body ?? {}) as IamImportRequest;
    try {
      const job = createIamImportJob(store, req.auth, body);
      emitAudit(
        store,
        actorFromAuth(req),
        'identity.iam_import_stub',
        { type: 'iam_import', id: job.id },
        { source: job.source, mappedUsers: job.mappedUsers, mappedGroups: job.mappedGroups },
        [1, 2],
      );
      touch();
      res.status(202).json({ job });
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
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

  router.get('/mcp/credentials/status', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    res.json(credentialsStatus(store, req.auth.tenantId));
  });

  /** Legacy GitHub-only path — prefer PUT /mcp/credentials/:serviceId. */
  router.put(
    '/mcp/credentials/github',
    requirePlatform(store, 'mcp.connect'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      const token = typeof (req.body as { token?: unknown })?.token === 'string'
        ? (req.body as { token: string }).token
        : '';
      if (!token.trim()) {
        res.status(400).json({ error: 'body.token is required' });
        return;
      }
      try {
        setGithubCredentials(store, req.auth.tenantId, token);
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid token' });
        return;
      }
      emitAudit(
        store,
        actorFromAuth(req),
        'mcp.credentials.github_saved',
        { type: 'mcp_credentials', id: 'github' },
        {},
        [1, 2, 5],
      );
      touch();
      res.json({ ok: true, github: { hasToken: true } });
    },
  );

  router.put(
    '/mcp/credentials/:serviceId',
    requirePlatform(store, 'mcp.connect'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      const serviceId = req.params.serviceId as ServiceId;
      const body = (req.body ?? {}) as {
        token?: unknown;
        roleArn?: unknown;
        subscriptionId?: unknown;
        azureTenantId?: unknown;
        projectId?: unknown;
        clientId?: unknown;
      };

      if (isIamService(serviceId)) {
        try {
          setIamCredentials(store, req.auth.tenantId, serviceId, {
            roleArn: typeof body.roleArn === 'string' ? body.roleArn : undefined,
            subscriptionId: typeof body.subscriptionId === 'string' ? body.subscriptionId : undefined,
            azureTenantId: typeof body.azureTenantId === 'string' ? body.azureTenantId : undefined,
            projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
            clientId: typeof body.clientId === 'string' ? body.clientId : undefined,
          });
        } catch (e) {
          res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid IAM credentials' });
          return;
        }
        emitAudit(
          store,
          actorFromAuth(req),
          'mcp.credentials.iam_saved',
          { type: 'mcp_credentials', id: serviceId },
          {},
          [1, 2, 5],
        );
        touch();
        res.json({ ok: true, serviceId, iam: { linked: true } });
        return;
      }

      const token = typeof body.token === 'string' ? body.token : '';
      if (!token.trim()) {
        res.status(400).json({ error: 'body.token is required' });
        return;
      }
      try {
        setServiceToken(store, req.auth.tenantId, serviceId, token);
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid token' });
        return;
      }
      emitAudit(
        store,
        actorFromAuth(req),
        'mcp.credentials.token_saved',
        { type: 'mcp_credentials', id: serviceId },
        {},
        [1, 2, 5],
      );
      touch();
      res.json({ ok: true, serviceId, hasToken: true });
    },
  );

  router.get('/mcp/oauth/atlassian/status', (req: AuthedRequest, res) => {
    const lookup =
      req.auth?.tenantId != null ? { store, tenantId: req.auth.tenantId } : undefined;
    res.json(getAtlassianMcpOAuthStatus(lookup));
  });

  router.get('/mcp/oauth/atlassian/start', requirePlatform(store, 'mcp.connect'), (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const started = buildAtlassianAuthorizeUrl(req.auth.tenantId);
    if (!started) {
      res.status(503).json({
        error: 'Atlassian MCP OAuth is not configured',
        status: getAtlassianMcpOAuthStatus({ store, tenantId: req.auth.tenantId }),
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
      const tokens = await completeAtlassianOAuthCallback({ code, state });
      setAtlassianCredentials(store, tokens.tenantId, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      });
      touch();
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

  // —— Generic MCP OAuth packs (Linear / GitLab / Slack / Microsoft / Google) ——
  router.get('/mcp/oauth/status', (req: AuthedRequest, res) => {
    const lookup =
      req.auth?.tenantId != null ? { store, tenantId: req.auth.tenantId } : undefined;
    res.json({
      atlassian: getAtlassianMcpOAuthStatus(lookup),
      providers: listProviderOAuthStatuses(lookup),
    });
  });

  router.get('/mcp/oauth/:provider/status', (req: AuthedRequest, res) => {
    const provider = req.params.provider ?? '';
    if (provider === 'atlassian') {
      const lookup =
        req.auth?.tenantId != null ? { store, tenantId: req.auth.tenantId } : undefined;
      res.json(getAtlassianMcpOAuthStatus(lookup));
      return;
    }
    if (!isProviderOAuthFamily(provider)) {
      res.status(404).json({ error: `Unknown OAuth provider '${provider}'` });
      return;
    }
    const lookup =
      req.auth?.tenantId != null ? { store, tenantId: req.auth.tenantId } : undefined;
    res.json(getProviderOAuthStatus(provider, lookup));
  });

  router.get(
    '/mcp/oauth/:provider/start',
    requirePlatform(store, 'mcp.connect'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      const provider = req.params.provider ?? '';
      if (provider === 'atlassian') {
        const started = buildAtlassianAuthorizeUrl(req.auth.tenantId);
        if (!started) {
          res.status(503).json({
            error: 'Atlassian MCP OAuth is not configured',
            status: getAtlassianMcpOAuthStatus({ store, tenantId: req.auth.tenantId }),
          });
          return;
        }
        res.json({ authorizeUrl: started.url, state: started.state });
        return;
      }
      if (!isProviderOAuthFamily(provider)) {
        res.status(404).json({ error: `Unknown OAuth provider '${provider}'` });
        return;
      }
      const started = buildProviderAuthorizeUrl(provider, req.auth.tenantId);
      if (!started) {
        res.status(503).json({
          error: `${provider} MCP OAuth is not configured`,
          status: getProviderOAuthStatus(provider, { store, tenantId: req.auth.tenantId }),
        });
        return;
      }
      res.json({ authorizeUrl: started.url, state: started.state });
    },
  );

  router.get('/mcp/oauth/:provider/callback', async (req, res) => {
    const providerParam = req.params.provider ?? '';
    const webOrigin = process.env.WEB_APP_ORIGIN?.trim() || 'http://localhost:3000';
    const dest = new URL('/connections', webOrigin);
    const flag = `${providerParam}_mcp`;

    if (providerParam === 'atlassian') {
      // Handled by dedicated route above — should not reach here if registered first.
      res.status(404).json({ error: 'Use /mcp/oauth/atlassian/callback' });
      return;
    }
    if (!isProviderOAuthFamily(providerParam)) {
      dest.searchParams.set(flag, 'error');
      dest.searchParams.set(`${flag}_error`, 'unknown provider');
      res.redirect(302, dest.toString());
      return;
    }
    const provider = providerParam as ProviderOAuthFamily;

    const err = typeof req.query.error === 'string' ? req.query.error : null;
    if (err) {
      const desc =
        typeof req.query.error_description === 'string' ? req.query.error_description : err;
      dest.searchParams.set(flag, 'error');
      dest.searchParams.set(`${flag}_error`, desc);
      res.redirect(302, dest.toString());
      return;
    }
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code || !state) {
      dest.searchParams.set(flag, 'error');
      dest.searchParams.set(`${flag}_error`, 'missing code/state');
      res.redirect(302, dest.toString());
      return;
    }
    try {
      const tokens = await completeProviderOAuthCallback({ provider, code, state });
      setProviderOAuthCredentials(store, tokens.tenantId, tokens.provider, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      });
      touch();
      dest.searchParams.set(flag, 'ok');
      res.redirect(302, dest.toString());
    } catch (e) {
      dest.searchParams.set(flag, 'error');
      dest.searchParams.set(
        `${flag}_error`,
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
    const envId = resolveActiveEnvironmentId(store, req.auth.tenantId);
    if (!userCanAccessEnvironment(store, req.auth, envId)) {
      res.status(403).json({ error: 'no access to this environment' });
      return;
    }
    res.json({
      connections: tenantConnections(store, req.auth.tenantId, envId),
      environmentId: envId,
    });
  });

  router.post(
    '/mcp/connections/:serviceId',
    requirePlatform(store, 'mcp.connect'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      const envId = resolveActiveEnvironmentId(store, req.auth.tenantId);
      if (!userCanAccessEnvironment(store, req.auth, envId)) {
        res.status(403).json({ error: 'no access to this environment' });
        return;
      }
      const serviceId = req.params.serviceId as ServiceId;
      const provider = getMcpProvider(serviceId);
      if (!provider?.connectable) {
        res.status(400).json({ error: `Service '${serviceId}' has no connectable MCP option` });
        return;
      }
      const body = (req.body ?? {}) as Partial<McpConnectRequest>;
      // Default to admin for owner-connected services; still accept explicit levels.
      const permissionLevel = isPermissionLevel(body.permissionLevel)
        ? body.permissionLevel
        : 'admin';
      if (!isPermissionLevel(permissionLevel)) {
        res.status(400).json({ error: 'body.permissionLevel must be read | write | admin' });
        return;
      }

      const precheck = precheckConnect(store, req.auth.tenantId, serviceId);
      if (!precheck.ok) {
        emitAudit(
          store,
          actorFromAuth(req),
          'mcp.connect_blocked',
          { type: 'mcp_connection', id: serviceId },
          { code: precheck.code, authState: precheck.authState, environmentId: envId },
          [1, 2, 5],
        );
        touch();
        res.status(precheck.status).json({
          error: precheck.error,
          code: precheck.code,
          authorizePath: precheck.authorizePath,
        });
        return;
      }

      const connection = createConnection(serviceId, permissionLevel, {
        live: precheck.live,
        authState: precheck.authState,
        environmentId: envId,
      });
      const list = store.mcpConnectionsByTenant[req.auth.tenantId] ?? [];
      store.mcpConnectionsByTenant[req.auth.tenantId] = list;
      const idx = list.findIndex(
        (c) => c.serviceId === serviceId && c.environmentId === envId,
      );
      if (idx >= 0) list[idx] = connection;
      else list.push(connection);
      syncPolicyAllowlistFromConnections(store, req.auth.tenantId, envId);
      emitAudit(
        store,
        actorFromAuth(req),
        connection.status === 'connected' ? 'mcp.connected' : 'mcp.connect_failed',
        { type: 'mcp_connection', id: serviceId },
        {
          serverId: connection.serverId,
          permissionLevel: connection.permissionLevel,
          tools: connection.grantedTools.length,
          live: connection.live,
          error: connection.lastError,
          environmentId: envId,
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

  router.post(
    '/mcp/connections/:serviceId/verify',
    requirePlatform(store, 'mcp.connect'),
    async (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      const envId = resolveActiveEnvironmentId(store, req.auth.tenantId);
      if (!userCanAccessEnvironment(store, req.auth, envId)) {
        res.status(403).json({ error: 'no access to this environment' });
        return;
      }
      const serviceId = req.params.serviceId as ServiceId;
      const list = tenantConnections(store, req.auth.tenantId, envId);
      const connection = list.find((c) => c.serviceId === serviceId);
      if (!connection || connection.status !== 'connected') {
        res.status(404).json({ error: 'connection not found — connect the provider first' });
        return;
      }
      const readTool = connection.grantedTools[0];
      if (!readTool) {
        res.status(400).json({ error: 'connection has no granted tools to verify' });
        return;
      }
      const roleLevel = roleMcpLevel(store, req.auth, connection.serverId);
      const result = await callToolAsync(connection, readTool, {}, {
        store,
        tenantId: req.auth.tenantId,
        rolePermissionLevel: roleLevel === null && req.auth.isWorkspaceOwner ? 'admin' : roleLevel,
      });
      connection.updatedAt = new Date().toISOString();
      if (!result.ok) {
        connection.authState = 'error';
        connection.lastError = result.error;
        connection.live = false;
      } else {
        connection.authState = 'ready';
        connection.live = result.transport === 'remote_http';
        connection.lastError = undefined;
      }
      touch();
      res.status(result.ok ? 200 : 502).json({ connection, result });
    },
  );

  router.delete(
    '/mcp/connections/:serviceId',
    requirePlatform(store, 'mcp.connect'),
    (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      const envId = resolveActiveEnvironmentId(store, req.auth.tenantId);
      if (!userCanAccessEnvironment(store, req.auth, envId)) {
        res.status(403).json({ error: 'no access to this environment' });
        return;
      }
      const serviceId = req.params.serviceId as ServiceId;
      const list = store.mcpConnectionsByTenant[req.auth.tenantId] ?? [];
      store.mcpConnectionsByTenant[req.auth.tenantId] = list.filter(
        (c) => !(c.serviceId === serviceId && c.environmentId === envId),
      );
      emitAudit(
        store,
        actorFromAuth(req),
        'mcp.disconnected',
        { type: 'mcp_connection', id: serviceId },
        { environmentId: envId },
        [1, 2],
      );
      touch();
      res.json({ ok: true });
    },
  );

  router.post(
    '/mcp/connections/:serviceId/tools/:tool',
    requirePlatform(store, 'mcp.connect'),
    async (req: AuthedRequest, res) => {
      if (!req.auth) {
        res.status(401).json({ error: 'authentication required' });
        return;
      }
      const envId = resolveActiveEnvironmentId(store, req.auth.tenantId);
      if (!userCanAccessEnvironment(store, req.auth, envId)) {
        res.status(403).json({ error: 'no access to this environment' });
        return;
      }
      const serviceId = req.params.serviceId as ServiceId;
      const tool = req.params.tool!;
      const connection = tenantConnections(store, req.auth.tenantId, envId).find(
        (c) => c.serviceId === serviceId,
      );
      if (!connection) {
        res.status(404).json({ error: 'connection not found — connect the provider first' });
        return;
      }
      const roleLevel = roleMcpLevel(store, req.auth, connection.serverId);
      const result = await callToolAsync(
        connection,
        tool,
        (req.body ?? {}) as Record<string, unknown>,
        {
          store,
          tenantId: req.auth.tenantId,
          rolePermissionLevel: roleLevel === null && req.auth.isWorkspaceOwner ? 'admin' : roleLevel,
        },
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
          environmentId: envId,
        },
        [1, 2, 5],
      );
      touch();
      res.status(result.ok ? 200 : 403).json(result);
    },
  );

  // -- home layout prefs ----------------------------------------------------------
  router.get('/home/layout', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const key = `${req.auth.tenantId}:${req.auth.id}`;
    const layout = store.homeLayoutByUser[key] ?? {
      userId: req.auth.id,
      tenantId: req.auth.tenantId,
      widgets: [],
      updatedAt: new Date().toISOString(),
    };
    res.json({ layout });
  });

  router.put('/home/layout', (req: AuthedRequest, res) => {
    if (!req.auth) {
      res.status(401).json({ error: 'authentication required' });
      return;
    }
    const body = (req.body ?? {}) as UpdateHomeLayoutRequest;
    const allowed = new Set(['tickets', 'channels', 'approvals', 'activity']);
    const widgets = Array.isArray(body.widgets)
      ? body.widgets.filter((w): w is 'tickets' | 'channels' | 'approvals' | 'activity' =>
          typeof w === 'string' && allowed.has(w),
        )
      : [];
    const key = `${req.auth.tenantId}:${req.auth.id}`;
    const layout = {
      userId: req.auth.id,
      tenantId: req.auth.tenantId,
      widgets,
      updatedAt: new Date().toISOString(),
    };
    store.homeLayoutByUser[key] = layout;
    touch();
    res.json({ layout });
  });

  return router;
}
