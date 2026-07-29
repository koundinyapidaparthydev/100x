/**
 * Typed client for the single OffshoreHelper backend.
 * Both web and mobile apps use this — there is exactly one API.
 * In dev, each Vite server proxies `/api` → http://localhost:4000.
 */

import type {
  AiJob,
  AiStatus,
  ApprovalItem,
  ApprovalStatus,
  AuditEvent,
  BoardConnectRequest,
  BoardHealth,
  DashboardStats,
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

/** Demo session identity used for audit attribution (H0 — not real SSO). */
export function setApiActor(id: string | null, surface: 'web' | 'mobile' = 'web'): void {
  actorId = id;
  actorSurface = surface;
}

export function getApiActor(): { id: string | null; surface: 'web' | 'mobile' } {
  return { id: actorId, surface: actorSurface };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
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
  health: () => request<{ status: 'ok'; version: string }>('/health'),

  // Work items (Jira tickets mirrored into OffshoreHelper)
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
  /** Manager swipe decision. aiFirst=true enqueues an AI job through the PII gate. */
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

  // Boards (Jira projects + sync health)
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

  // AI jobs
  listJobs: () => request<AiJob[]>('/ai-jobs'),
  getJob: (id: string) => request<AiJob>(`/ai-jobs/${encodeURIComponent(id)}`),

  // Policies
  listPolicies: () => request<Policy[]>('/policies'),
  getPolicy: (id: string) => request<Policy>(`/policies/${encodeURIComponent(id)}`),
  updatePolicy: (id: string, body: PolicyUpdate) =>
    request<Policy>(`/policies/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  // Audit
  listAuditEvents: () => request<AuditEvent[]>('/audit-events'),

  // Dashboard aggregate
  stats: () => request<DashboardStats>('/stats'),

  // Approvals (high-risk AI actions awaiting manager decision)
  listApprovals: () => request<ApprovalItem[]>('/approvals'),
  decideApproval: (id: string, decision: Exclude<ApprovalStatus, 'pending'>) =>
    request<ApprovalItem>(`/approvals/${encodeURIComponent(id)}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),

  // Notifications
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
