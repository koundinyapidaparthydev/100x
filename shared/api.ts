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
  BoardHealth,
  DashboardStats,
  NotificationItem,
  Policy,
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
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
  listWorkItems: (filter?: { aiStatus?: AiStatus; aiFirst?: boolean }) =>
    request<WorkItem[]>(`/work-items${qs({ aiStatus: filter?.aiStatus, aiFirst: filter?.aiFirst })}`),
  getWorkItem: (id: string) => request<WorkItem>(`/work-items/${encodeURIComponent(id)}`),
  /** Manager swipe decision. aiFirst=true enqueues an AI job through the PII gate. */
  triageWorkItem: (id: string, body: TriageRequest) =>
    request<TriageResponse>(`/work-items/${encodeURIComponent(id)}/triage`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Boards (Jira projects + sync health)
  listBoards: () => request<BoardHealth[]>('/boards'),

  // AI jobs
  listJobs: () => request<AiJob[]>('/ai-jobs'),
  getJob: (id: string) => request<AiJob>(`/ai-jobs/${encodeURIComponent(id)}`),

  // Policies
  listPolicies: () => request<Policy[]>('/policies'),
  getPolicy: (id: string) => request<Policy>(`/policies/${encodeURIComponent(id)}`),

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
};
