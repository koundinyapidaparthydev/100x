/**
 * Typed client for the single 100x backend.
 * Both web and mobile apps use this — there is exactly one API.
 * In dev, each Vite server proxies `/api` → http://localhost:4000.
 */

import type {
  AiJob,
  AiStatus,
  ApprovalItem,
  ApprovalStatus,
  AuditEvent,
  AuthSession,
  AuthUser,
  ApproveCallSetRequest,
  BoardConnectRequest,
  BoardHealth,
  CreateAccessKeyRequest,
  CreateAccessKeyResponse,
  CreateCallSetRequest,
  CreateCustomModelRequest,
  CreateCustomRoleRequest,
  CreateEnvironmentRequest,
  CreateIdentityGroupRequest,
  CreateInviteRequest,
  CreateInviteResponse,
  CreatePasskeyRequest,
  CreateRoleResponse,
  CreateSkillPackRequest,
  CustomModel,
  DashboardStats,
  DemoRunResponse,
  DemoStatusResponse,
  EnsureEnvironmentsRequest,
  HealthResponse,
  FederatedAuthProvider,
  FederatedExchangeResponse,
  FederatedProvidersStatusResponse,
  FederatedProviderStatus,
  IamImportRequest,
  IamImportResponse,
  IdentityGroup,
  LinkSolutionsRequest,
  ListConsoleServicesResponse,
  ListIdentityGroupsResponse,
  ListInvitesResponse,
  ListRolesResponse,
  ListTenantUsersResponse,
  LoginRequest,
  MergeCallSetRequest,
  HomeLayoutPrefs,
  HomeWidgetId,
  NotificationItem,
  OktaExchangeResponse,
  OktaStatus,
  McpConnectRequest,
  McpConnectionsResponse,
  McpConnectErrorCode,
  McpPermissionLevel,
  OnboardingProfile,
  OnboardingUpsertRequest,
  Policy,
  PolicyUpdate,
  ServiceId,
  ServiceMcpConnection,
  SetActiveEnvironmentRequest,
  SkillPack,
  Solution,
  SolutionCallSet,
  TenantUser,
  TriageRequest,
  TriageResponse,
  UpdateCustomRoleRequest,
  UpdateHomeLayoutRequest,
  UpdateIdentityGroupRequest,
  UpdateRoleResponse,
  UpdateSecuritySettingsRequest,
  UpdateTenantUserRequest,
  UpdateUserEnvironmentGrantsRequest,
  UserEnvironmentGrantsResponse,
  UserSecuritySettings,
  WorkItem,
  WorkspaceEnvironmentState,
  WorkspaceInvite,
  WorkspaceSetupRequest,
  WorkspaceSetupResponse,
} from './types';

export const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: McpConnectErrorCode | string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let actorId: string | null = null;
let actorSurface: 'web' | 'mobile' = 'web';
let sessionToken: string | null = null;

/** Demo session identity used for audit attribution (H0 compat headers). */
export function setApiActor(id: string | null, surface: 'web' | 'mobile' = 'web'): void {
  actorId = id;
  actorSurface = surface;
}

export function getApiActor(): { id: string | null; surface: 'web' | 'mobile' } {
  return { id: actorId, surface: actorSurface };
}

/** H1 Bearer session token. Preferred over legacy actor headers. */
export function setSessionToken(token: string | null): void {
  sessionToken = token;
}

export function getSessionToken(): string | null {
  return sessionToken;
}

export function clearSession(): void {
  sessionToken = null;
  actorId = null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }
  if (actorId) {
    headers['x-actor-id'] = actorId;
    headers['x-actor-surface'] = actorSurface;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    let code: string | undefined;
    let details: Record<string, unknown> | undefined;
    try {
      const body = (await res.json()) as {
        error?: string;
        code?: string;
        authorizePath?: string;
        [key: string]: unknown;
      };
      if (body.error) message = body.error;
      if (body.code) code = body.code;
      details = body;
    } catch {
      /* keep default message */
    }
    throw new ApiError(res.status, message, code, details);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export const api = {
  health: () => request<HealthResponse>('/health'),
  demoStatus: () => request<DemoStatusResponse>('/demo/status'),
  demoRun: () =>
    request<DemoRunResponse>('/demo/run', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  // Auth
  listDemoUsers: () =>
    request<
      Array<Pick<AuthUser, 'id' | 'displayName' | 'email' | 'roleId' | 'isWorkspaceOwner'>>
    >('/auth/demo-users'),
  login: async (body: LoginRequest) => {
    const res = await request<{ session: AuthSession }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setSessionToken(res.session.token);
    setApiActor(res.session.user.id, res.session.user.surface);
    return res;
  },
  logout: async () => {
    try {
      await request<{ ok: boolean }>('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
    } finally {
      clearSession();
    }
  },
  me: () => request<{ user: AuthUser }>('/auth/me'),

  /** Status for every federated IdP (Okta, Entra, Google Workspace, Google, Apple). */
  authProvidersStatus: () => request<FederatedProvidersStatusResponse>('/auth/providers'),

  /** Whether a single IdP is configured on the backend. */
  authProviderStatus: (provider: FederatedAuthProvider) =>
    request<FederatedProviderStatus>(`/auth/${provider}/status`),

  /**
   * Full-page navigate to start federated OIDC (backend 302 → IdP).
   * Prefer window.location.assign(authStartUrl(...)) from the web app.
   */
  authStartUrl: (
    provider: FederatedAuthProvider,
    intent: 'login' | 'signup' = 'login',
    surface: 'web' | 'mobile' = 'web',
  ) =>
    `${API_BASE}/auth/${provider}/start?intent=${encodeURIComponent(intent)}&surface=${encodeURIComponent(surface)}`,

  /** One-time exchange after IdP callback redirect to /auth/callback. */
  federatedExchange: async (exchange: string) => {
    const res = await request<FederatedExchangeResponse>('/auth/federated/exchange', {
      method: 'POST',
      body: JSON.stringify({ exchange }),
    });
    setSessionToken(res.session.token);
    setApiActor(res.session.user.id, res.session.user.surface);
    return res;
  },

  /** @deprecated Prefer authProviderStatus('okta') */
  oktaStatus: () => request<OktaStatus>('/auth/okta/status'),

  /** @deprecated Prefer authStartUrl('okta', …) */
  oktaStartUrl: (intent: 'login' | 'signup' = 'login') =>
    `${API_BASE}/auth/okta/start?intent=${encodeURIComponent(intent)}&surface=web`,

  /** @deprecated Prefer federatedExchange */
  oktaExchange: async (exchange: string) => {
    const res = await request<OktaExchangeResponse>('/auth/okta/exchange', {
      method: 'POST',
      body: JSON.stringify({ exchange }),
    });
    setSessionToken(res.session.token);
    setApiActor(res.session.user.id, res.session.user.surface);
    return res;
  },

  // Work items
  listWorkItems: (filter?: {
    aiStatus?: AiStatus;
    aiFirst?: boolean;
    projectId?: string;
    triagePending?: boolean;
  }) =>
    request<WorkItem[]>(
      `/work-items${qs({
        aiStatus: filter?.aiStatus,
        aiFirst: filter?.aiFirst,
        projectId: filter?.projectId,
        triagePending: filter?.triagePending,
      })}`,
    ),
  getWorkItem: (id: string) => request<WorkItem>(`/work-items/${encodeURIComponent(id)}`),
  triageWorkItem: (id: string, body: TriageRequest) =>
    request<TriageResponse>(`/work-items/${encodeURIComponent(id)}/triage`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateAssignee: (id: string, assigneeExternalId: string | null) =>
    request<WorkItem>(`/work-items/${encodeURIComponent(id)}/assignee`, {
      method: 'PATCH',
      body: JSON.stringify({ assigneeExternalId }),
    }),
  requestPiiAccess: (id: string, reason?: string) =>
    request<ApprovalItem>(`/work-items/${encodeURIComponent(id)}/request-access`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  listBoards: () => request<BoardHealth[]>('/boards'),
  connectBoard: (body: BoardConnectRequest) =>
    request<BoardHealth>('/boards/connect', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  syncBoard: (projectId: string) =>
    request<BoardHealth>(`/boards/${encodeURIComponent(projectId)}/sync`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  listJobs: () => request<AiJob[]>('/ai-jobs'),
  getJob: (id: string) => request<AiJob>(`/ai-jobs/${encodeURIComponent(id)}`),

  listPolicies: () => request<Policy[]>('/policies'),
  getPolicy: (id: string) => request<Policy>(`/policies/${encodeURIComponent(id)}`),
  updatePolicy: (id: string, body: PolicyUpdate) =>
    request<Policy>(`/policies/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listAuditEvents: () => request<AuditEvent[]>('/audit-events'),
  stats: () => request<DashboardStats>('/stats'),

  listApprovals: () => request<ApprovalItem[]>('/approvals'),
  decideApproval: (id: string, decision: Exclude<ApprovalStatus, 'pending'>) =>
    request<ApprovalItem>(`/approvals/${encodeURIComponent(id)}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),

  listNotifications: () => request<NotificationItem[]>('/notifications'),
  markNotificationRead: (id: string) =>
    request<NotificationItem>(`/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  markAllNotificationsRead: () =>
    request<{ ok: boolean; count: number }>('/notifications/read-all', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  // Onboarding (per-user profile)
  getOnboarding: () => request<{ profile: OnboardingProfile | null }>('/onboarding'),
  putOnboarding: (body: OnboardingUpsertRequest) =>
    request<{ profile: OnboardingProfile }>('/onboarding', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  // Workspace invites (root only; SendGrid when configured, else stub outbox)
  listInvites: () => request<ListInvitesResponse>('/invites'),
  createInvite: (body: CreateInviteRequest) =>
    request<CreateInviteResponse>('/invites', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  resendInvite: (id: string) =>
    request<CreateInviteResponse>(`/invites/${encodeURIComponent(id)}/resend`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  revokeInvite: (id: string) =>
    request<{ invite: WorkspaceInvite }>(`/invites/${encodeURIComponent(id)}/revoke`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  // Workspace company / primary-account gate (post-Google)
  getWorkspaceSetup: () =>
    request<{ user: AuthUser; complete: boolean }>('/workspace/setup'),
  putWorkspaceSetup: (body: WorkspaceSetupRequest) =>
    request<WorkspaceSetupResponse>('/workspace/setup', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  // Workspace environments (Production / Staging / Development + custom)
  listEnvironments: () => request<WorkspaceEnvironmentState>('/environments'),
  setActiveEnvironment: (body: SetActiveEnvironmentRequest) =>
    request<WorkspaceEnvironmentState>('/environments/active', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  createEnvironment: (body: CreateEnvironmentRequest) =>
    request<WorkspaceEnvironmentState>('/environments', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  ensureEnvironments: (body: EnsureEnvironmentsRequest) =>
    request<WorkspaceEnvironmentState>('/environments/ensure', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Solutions / learning (custom models + skills)
  listCallSets: () => request<{ callSets: SolutionCallSet[] }>('/call-sets'),
  createCallSet: (body: CreateCallSetRequest) =>
    request<SolutionCallSet>('/call-sets', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  approveCallSet: (id: string, body: ApproveCallSetRequest = {}) =>
    request<SolutionCallSet>(`/call-sets/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  mergeCallSet: (id: string, body: MergeCallSetRequest) =>
    request<SolutionCallSet>(`/call-sets/${encodeURIComponent(id)}/merge`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  rejectCallSet: (id: string) =>
    request<SolutionCallSet>(`/call-sets/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  promoteCallSet: (id: string) =>
    request<{ callSet: SolutionCallSet; solution: Solution }>(
      `/call-sets/${encodeURIComponent(id)}/promote`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    ),
  listSolutions: () => request<{ solutions: Solution[] }>('/solutions'),
  archiveSolution: (id: string) =>
    request<Solution>(`/solutions/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  listCustomModels: () => request<{ models: CustomModel[] }>('/custom-models'),
  createCustomModel: (body: CreateCustomModelRequest) =>
    request<CustomModel>('/custom-models', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  linkSolutionsToModel: (id: string, body: LinkSolutionsRequest) =>
    request<CustomModel>(`/custom-models/${encodeURIComponent(id)}/link-solutions`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  trainCustomModel: (id: string) =>
    request<CustomModel>(`/custom-models/${encodeURIComponent(id)}/train`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  archiveCustomModel: (id: string) =>
    request<CustomModel>(`/custom-models/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  listSkillPacks: () => request<{ skillPacks: SkillPack[] }>('/skill-packs'),
  createSkillPack: (body: CreateSkillPackRequest) =>
    request<SkillPack>('/skill-packs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  linkSolutionsToSkill: (id: string, body: LinkSolutionsRequest) =>
    request<SkillPack>(`/skill-packs/${encodeURIComponent(id)}/link-solutions`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  submitSkillForReview: (id: string) =>
    request<SkillPack>(`/skill-packs/${encodeURIComponent(id)}/submit-review`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  publishSkillPack: (id: string) =>
    request<SkillPack>(`/skill-packs/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  exportSkillPack: (id: string) =>
    request<{ pack: SkillPack; markdown: string; solutions: Solution[] }>(
      `/skill-packs/${encodeURIComponent(id)}/export`,
    ),
  archiveSkillPack: (id: string) =>
    request<SkillPack>(`/skill-packs/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  // Account security (2FA / passkeys / platform access keys)
  getSecuritySettings: () => request<{ settings: UserSecuritySettings }>('/security'),
  updateSecuritySettings: (body: UpdateSecuritySettingsRequest) =>
    request<{ settings: UserSecuritySettings }>('/security', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  registerPasskey: (body: CreatePasskeyRequest) =>
    request<{ settings: UserSecuritySettings }>('/security/passkeys', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  revokePasskey: (id: string) =>
    request<{ settings: UserSecuritySettings }>(`/security/passkeys/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  createAccessKey: (body: CreateAccessKeyRequest) =>
    request<CreateAccessKeyResponse>('/security/access-keys', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  revokeAccessKey: (id: string) =>
    request<{ settings: UserSecuritySettings }>(
      `/security/access-keys/${encodeURIComponent(id)}/revoke`,
      { method: 'POST', body: JSON.stringify({}) },
    ),

  // Identity management
  listIdentityUsers: () => request<ListTenantUsersResponse>('/identity/users'),
  updateIdentityUser: (id: string, body: UpdateTenantUserRequest) =>
    request<{ user: TenantUser }>(`/identity/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  listUserEnvironmentGrants: (id: string) =>
    request<UserEnvironmentGrantsResponse>(
      `/identity/users/${encodeURIComponent(id)}/environments`,
    ),
  setUserEnvironmentGrants: (id: string, body: UpdateUserEnvironmentGrantsRequest) =>
    request<UserEnvironmentGrantsResponse>(
      `/identity/users/${encodeURIComponent(id)}/environments`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      },
    ),
  listIdentityRoles: () => request<ListRolesResponse>('/identity/roles'),
  createIdentityRole: (body: CreateCustomRoleRequest) =>
    request<CreateRoleResponse>('/identity/roles', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateIdentityRole: (id: string, body: UpdateCustomRoleRequest) =>
    request<UpdateRoleResponse>(`/identity/roles/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteIdentityRole: (id: string) =>
    request<void>(`/identity/roles/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  listIdentityGroups: () => request<ListIdentityGroupsResponse>('/identity/groups'),
  createIdentityGroup: (body: CreateIdentityGroupRequest) =>
    request<{ group: IdentityGroup }>('/identity/groups', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateIdentityGroup: (id: string, body: UpdateIdentityGroupRequest) =>
    request<{ group: IdentityGroup }>(`/identity/groups/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteIdentityGroup: (id: string) =>
    request<void>(`/identity/groups/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  listConsoleServices: () => request<ListConsoleServicesResponse>('/identity/services'),
  listIamImports: () => request<{ jobs: import('./types').IamImportJob[] }>('/identity/iam-imports'),
  createIamImport: (body: IamImportRequest) =>
    request<IamImportResponse>('/identity/iam-imports', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // MCP connections — connect each provider one-by-one (scoped to active environment)
  listMcpConnections: () => request<McpConnectionsResponse>('/mcp/connections'),
  connectMcpService: (serviceId: ServiceId, permissionLevel: McpPermissionLevel = 'admin') =>
    request<{ connection: ServiceMcpConnection }>(
      `/mcp/connections/${encodeURIComponent(serviceId)}`,
      {
        method: 'POST',
        body: JSON.stringify({ permissionLevel } satisfies McpConnectRequest),
      },
    ),
  disconnectMcpService: (serviceId: ServiceId) =>
    request<{ ok: boolean }>(`/mcp/connections/${encodeURIComponent(serviceId)}`, {
      method: 'DELETE',
    }),
  verifyMcpConnection: (serviceId: ServiceId) =>
    request<{ connection: ServiceMcpConnection; result: unknown }>(
      `/mcp/connections/${encodeURIComponent(serviceId)}/verify`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  callMcpTool: (serviceId: ServiceId, tool: string, args: Record<string, unknown> = {}) =>
    request<{
      ok: boolean;
      serverId: string;
      tool: string;
      data?: unknown;
      error?: string;
    }>(`/mcp/connections/${encodeURIComponent(serviceId)}/tools/${encodeURIComponent(tool)}`, {
      method: 'POST',
      body: JSON.stringify(args),
    }),

  getHomeLayout: () => request<{ layout: HomeLayoutPrefs }>('/home/layout'),
  putHomeLayout: (widgets: HomeWidgetId[]) =>
    request<{ layout: HomeLayoutPrefs }>('/home/layout', {
      method: 'PUT',
      body: JSON.stringify({ widgets } satisfies UpdateHomeLayoutRequest),
    }),

  getMcpCredentialsStatus: () =>
    request<{
      atlassian: { hasAccessToken: boolean };
      github: { hasToken: boolean };
      tokens?: Partial<Record<ServiceId, { hasToken: boolean }>>;
      oauth?: Record<string, { hasAccessToken: boolean }>;
      iam?: Partial<Record<ServiceId, { linked: boolean }>>;
    }>('/mcp/credentials/status'),

  saveGithubMcpToken: (token: string) =>
    request<{ ok: boolean; github: { hasToken: boolean } }>('/mcp/credentials/github', {
      method: 'PUT',
      body: JSON.stringify({ token }),
    }),

  saveMcpServiceToken: (serviceId: ServiceId, token: string) =>
    request<{ ok: boolean; serviceId: ServiceId; hasToken: boolean }>(
      `/mcp/credentials/${encodeURIComponent(serviceId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ token }),
      },
    ),

  saveMcpIamCredentials: (
    serviceId: ServiceId,
    body: {
      roleArn?: string;
      subscriptionId?: string;
      azureTenantId?: string;
      projectId?: string;
      clientId?: string;
    },
  ) =>
    request<{ ok: boolean; serviceId: ServiceId; iam: { linked: boolean } }>(
      `/mcp/credentials/${encodeURIComponent(serviceId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      },
    ),

  listMcpTransports: () =>
    request<{
      transports: Array<{
        serviceId: ServiceId;
        kind: string;
        ready: boolean;
        note: string;
        endpoint?: string;
      }>;
    }>('/mcp/transports'),

  getAtlassianMcpOAuthStatus: () =>
    request<{
      enabled: boolean;
      authorizeReady: boolean;
      hasAccessToken: boolean;
      clientId?: string;
      redirectUri?: string;
      note: string;
    }>('/mcp/oauth/atlassian/status'),

  startAtlassianMcpOAuth: () =>
    request<{ authorizeUrl: string; state: string }>('/mcp/oauth/atlassian/start'),

  getMcpProviderOAuthStatus: (provider: string) =>
    request<{
      provider?: string;
      enabled: boolean;
      authorizeReady: boolean;
      hasAccessToken: boolean;
      clientId?: string;
      redirectUri?: string;
      note: string;
    }>(`/mcp/oauth/${encodeURIComponent(provider)}/status`),

  listMcpOAuthStatuses: () =>
    request<{
      atlassian: {
        enabled: boolean;
        authorizeReady: boolean;
        hasAccessToken: boolean;
        note: string;
      };
      providers: Array<{
        provider: string;
        enabled: boolean;
        authorizeReady: boolean;
        hasAccessToken: boolean;
        note: string;
      }>;
    }>('/mcp/oauth/status'),

  startMcpProviderOAuth: (provider: string) =>
    request<{ authorizeUrl: string; state: string }>(
      `/mcp/oauth/${encodeURIComponent(provider)}/start`,
    ),
};
