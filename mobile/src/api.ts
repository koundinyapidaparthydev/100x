import type {
  AiJob,
  AiStatus,
  ApprovalItem,
  ApprovalStatus,
  AuditEvent,
  AuthSession,
  DashboardStats,
  FederatedAuthProvider,
  FederatedExchangeResponse,
  FederatedProvidersStatusResponse,
  NotificationItem,
  Policy,
  TriageRequest,
  TriageResponse,
  WorkItem,
} from '@shared/types';

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1'
).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let sessionToken: string | null = null;

export function setSessionToken(token: string | null) {
  sessionToken = token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep the status-based message for non-JSON failures.
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function query(params: Record<string, string | boolean | undefined>) {
  const pairs = Object.entries(params)
    .filter((entry): entry is [string, string | boolean] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

export const api = {
  login: async (identity = 'manager') => {
    const result = await request<{ session: AuthSession }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identity, surface: 'mobile' }),
    });
    setSessionToken(result.session.token);
    return result;
  },
  authProvidersStatus: () => request<FederatedProvidersStatusResponse>('/auth/providers'),
  authStartUrl: (provider: FederatedAuthProvider, intent: 'login' | 'signup' = 'login') =>
    `${API_BASE_URL}/auth/${provider}/start?intent=${encodeURIComponent(intent)}&surface=mobile`,
  federatedExchange: async (exchange: string) => {
    const result = await request<FederatedExchangeResponse>('/auth/federated/exchange', {
      method: 'POST',
      body: JSON.stringify({ exchange }),
    });
    setSessionToken(result.session.token);
    return result;
  },
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST', body: '{}' }),
  listWorkItems: (filter?: { aiStatus?: AiStatus; projectId?: string; triagePending?: boolean }) =>
    request<WorkItem[]>(`/work-items${query(filter ?? {})}`),
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
  listBoards: () =>
    request<{ projectId: string; name: string }[]>('/boards'),
  listJobs: () => request<AiJob[]>('/ai-jobs'),
  getJob: (id: string) => request<AiJob>(`/ai-jobs/${encodeURIComponent(id)}`),
  listPolicies: () => request<Policy[]>('/policies'),
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
      body: '{}',
    }),
  markAllNotificationsRead: () =>
    request<{ ok: boolean; count: number }>('/notifications/read-all', {
      method: 'POST',
      body: '{}',
    }),
};
