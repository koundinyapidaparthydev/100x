import type { ApprovalItem, AuditEvent, BoardHealth, WorkItem } from '@shared/types';
import { projectRoutes } from './projectRoutes';

/** URL-backed work queue filters. */
export type WorkQueueFilter =
  | 'attention'
  | 'triage'
  | 'running'
  | 'review'
  | 'blocked'
  | 'human'
  | 'all';

export const WORK_QUEUE_FILTERS: { id: WorkQueueFilter; label: string }[] = [
  { id: 'attention', label: 'Needs attention' },
  { id: 'triage', label: 'Needs triage' },
  { id: 'running', label: 'Running' },
  { id: 'review', label: 'Ready for review' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'human', label: 'Human assigned' },
  { id: 'all', label: 'All' },
];

export const DEFAULT_WORK_FILTER: WorkQueueFilter = 'attention';

export function parseWorkQueueFilter(value: string | null): WorkQueueFilter {
  const match = WORK_QUEUE_FILTERS.find((f) => f.id === value);
  return match?.id ?? DEFAULT_WORK_FILTER;
}

export function needsTriage(item: WorkItem): boolean {
  return item.lastTriageDecision === null && item.aiStatus === 'none';
}

export function isRunning(item: WorkItem): boolean {
  return item.aiStatus === 'queued' || item.aiStatus === 'running';
}

export function isReadyForReview(item: WorkItem): boolean {
  return item.aiStatus === 'ready_for_human';
}

export function isBlocked(item: WorkItem): boolean {
  return item.aiStatus === 'blocked_pii' || item.aiStatus === 'failed';
}

export function isHumanAssigned(item: WorkItem): boolean {
  return item.lastTriageDecision === 'human_first';
}

/** Items a manager should process next in this project. */
export function needsAttention(item: WorkItem): boolean {
  return needsTriage(item) || isReadyForReview(item) || isBlocked(item);
}

export function matchesWorkFilter(item: WorkItem, filter: WorkQueueFilter): boolean {
  switch (filter) {
    case 'attention':
      return needsAttention(item);
    case 'triage':
      return needsTriage(item);
    case 'running':
      return isRunning(item);
    case 'review':
      return isReadyForReview(item);
    case 'blocked':
      return isBlocked(item);
    case 'human':
      return isHumanAssigned(item);
    case 'all':
      return true;
  }
}

export type AttentionReason = 'blocked' | 'review' | 'triage' | 'approval';

export function attentionReason(item: WorkItem): AttentionReason | null {
  if (isBlocked(item)) return 'blocked';
  if (isReadyForReview(item)) return 'review';
  if (needsTriage(item)) return 'triage';
  return null;
}

export const ATTENTION_REASON_LABEL: Record<AttentionReason, string> = {
  blocked: 'Blocked',
  review: 'Ready for review',
  triage: 'Needs triage',
  approval: 'Approval pending',
};

/** Priority for attention queue ordering (lower = higher priority). */
export function attentionPriority(item: WorkItem): number {
  const reason = attentionReason(item);
  if (reason === 'blocked') return 0;
  if (reason === 'review') return 1;
  if (reason === 'triage') return 2;
  return 9;
}

export interface ProjectAttentionCounts {
  triage: number;
  review: number;
  blocked: number;
  approvals: number;
  attention: number;
}

export function countAttention(
  items: WorkItem[],
  approvals: ApprovalItem[] = [],
): ProjectAttentionCounts {
  const triage = items.filter(needsTriage).length;
  const review = items.filter(isReadyForReview).length;
  const blocked = items.filter(isBlocked).length;
  const workIds = new Set(items.map((i) => i.id));
  const pendingApprovals = approvals.filter((a) => a.status === 'pending' && workIds.has(a.workItemId)).length;
  return {
    triage,
    review,
    blocked,
    approvals: pendingApprovals,
    attention: triage + review + blocked + pendingApprovals,
  };
}

export interface EnrichedApproval extends ApprovalItem {
  workItem: WorkItem | null;
}

export function enrichApprovals(
  approvals: ApprovalItem[],
  workItems: WorkItem[],
): EnrichedApproval[] {
  const byId = new Map(workItems.map((w) => [w.id, w]));
  return approvals.map((approval) => ({
    ...approval,
    workItem: byId.get(approval.workItemId) ?? null,
  }));
}

export function filterApprovalsForProject(
  enriched: EnrichedApproval[],
  projectId: string | undefined,
): EnrichedApproval[] {
  if (!projectId) return enriched;
  return enriched.filter((a) => a.workItem?.board.projectId === projectId);
}

export function workItemHref(item: WorkItem, filter?: WorkQueueFilter): string {
  const base = projectRoutes.workItem(item.board.projectId, item.id);
  if (!filter || filter === DEFAULT_WORK_FILTER) return base;
  return `${base}?filter=${encodeURIComponent(filter)}`;
}

export function workQueueHref(projectId: string, filter?: WorkQueueFilter): string {
  const base = projectRoutes.work(projectId);
  if (!filter || filter === DEFAULT_WORK_FILTER) return base;
  return `${base}?filter=${encodeURIComponent(filter)}`;
}

export function findBoard(boards: BoardHealth[], projectId: string): BoardHealth | undefined {
  return boards.find((b) => b.projectId === projectId);
}

/** Client-side project activity: events linked to the project's work or board id. */
export function filterAuditForProject(
  events: AuditEvent[],
  projectId: string,
  workItems: WorkItem[],
): AuditEvent[] {
  const workIds = new Set(workItems.map((w) => w.id));
  const issueKeys = new Set(workItems.map((w) => w.board.issueKey));
  return events
    .filter((event) => {
      if (event.resource.id === projectId) return true;
      if (workIds.has(event.resource.id) || issueKeys.has(event.resource.id)) return true;
      const metaWork = event.metadata?.workItemId;
      if (typeof metaWork === 'string' && workIds.has(metaWork)) return true;
      const metaProject = event.metadata?.projectId;
      if (typeof metaProject === 'string' && metaProject === projectId) return true;
      return false;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function sortAttentionItems(items: WorkItem[]): WorkItem[] {
  return [...items]
    .filter(needsAttention)
    .sort((a, b) => {
      const p = attentionPriority(a) - attentionPriority(b);
      if (p !== 0) return p;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
}
