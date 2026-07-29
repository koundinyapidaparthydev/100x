/**
 * Typed client for the single AplifyAI backend.
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
  BoardConnectRequest,
  BoardHealth,
  DashboardStats,
  LoginRequest,
  NotificationItem,
  Policy,
  PolicyUpdate,
  TriageRequest,
  TriageResponse,
  WorkItem,
} from './types';

export const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
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
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* keep default message */
    }
    throw new ApiError(res.status, message);
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
  health: () =>
    request<{ status: 'ok'; version: string; modelRunner?: string; boardConnector?: string }>('/health'),

  // Auth
  listDemoUsers: () =>
    request<Array<Pick<AuthUser, 'id' | 'displayName' | 'email' | 'role'>>>('/auth/demo-users'),
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
};
