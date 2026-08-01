import { Link } from 'react-router-dom';
import type { ApprovalItem, BoardHealth, WorkItem } from '@shared/types';
import { Card, StatusBadge, type CardTone } from '../ui';
import { humanize, timeAgo } from '../../lib/format';
import { projectRoutes } from '../../lib/projectRoutes';
import {
  ATTENTION_REASON_LABEL,
  attentionReason,
  sortAttentionItems,
  type AttentionReason,
} from '../../lib/workQueue';

export interface AttentionQueueProps {
  projectId: string;
  workItems: WorkItem[];
  approvals?: ApprovalItem[];
  limit?: number;
}

type QueueEntry =
  | { kind: 'work'; item: WorkItem; reason: AttentionReason }
  | { kind: 'approval'; approval: ApprovalItem; workItem: WorkItem | null; reason: 'approval' };

const REASON_TONE: Record<AttentionReason, CardTone> = {
  blocked: 'blush',
  review: 'mint',
  triage: 'butter',
  approval: 'butter',
};

const REASON_BADGE_TONE: Record<AttentionReason, 'danger' | 'success' | 'info' | 'warning'> = {
  blocked: 'danger',
  review: 'success',
  triage: 'info',
  approval: 'warning',
};

export function AttentionQueue({ projectId, workItems, approvals = [], limit = 8 }: AttentionQueueProps) {
  const byId = new Map(workItems.map((w) => [w.id, w]));
  const workEntries: QueueEntry[] = sortAttentionItems(workItems).map((item) => ({
    kind: 'work',
    item,
    reason: attentionReason(item)!,
  }));
  const approvalEntries: QueueEntry[] = approvals
    .filter((a) => a.status === 'pending')
    .filter((a) => {
      const wi = byId.get(a.workItemId);
      return wi?.board.projectId === projectId;
    })
    .map((approval) => ({
      kind: 'approval' as const,
      approval,
      workItem: byId.get(approval.workItemId) ?? null,
      reason: 'approval' as const,
    }));

  const entries = [...approvalEntries, ...workEntries].slice(0, limit);

  if (entries.length === 0) {
    return (
      <Card
        title="Needs attention"
        description="Nothing in this project needs a decision right now."
        hierarchy="secondary"
        data-testid="attention-queue"
      >
        <p className="text-sm text-on-surface-variant">
          Open the{' '}
          <Link to={projectRoutes.work(projectId)} className="font-semibold text-primary hover:underline">
            work queue
          </Link>{' '}
          to browse all items.
        </p>
      </Card>
    );
  }

  return (
    <section data-testid="attention-queue" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-on-surface">Needs attention</h2>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            Triage, review, blocks, and pending approvals — open a card to act.
          </p>
        </div>
        <Link
          to={`${projectRoutes.work(projectId)}?filter=attention`}
          className="text-sm font-semibold text-primary hover:underline"
        >
          View all
        </Link>
      </div>

      <ul className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {entries.map((entry) => {
          if (entry.kind === 'approval') {
            const href = entry.workItem
              ? projectRoutes.workItem(entry.workItem.board.projectId, entry.workItem.id)
              : projectRoutes.approvals(projectId);
            const issueKey = entry.workItem ? entry.workItem.board.issueKey : entry.approval.workItemId;
            return (
              <li key={`approval-${entry.approval.id}`} className="w-[16.5rem] shrink-0 sm:w-[18rem]">
                <Link to={href} className="block h-full rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <Card tone={REASON_TONE.approval} className="flex h-full flex-col gap-3 p-3.5 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono text-xs opacity-80">{issueKey}</p>
                      <StatusBadge
                        status="approval"
                        tone={REASON_BADGE_TONE.approval}
                        label={ATTENTION_REASON_LABEL.approval}
                      />
                    </div>
                    <p className="line-clamp-2 flex-1 text-sm font-semibold leading-5">{entry.approval.title}</p>
                    <div className="mt-auto flex items-center justify-between gap-2">
                      <p className="text-xs opacity-75">Requested {timeAgo(entry.approval.requestedAt)}</p>
                      <span className="text-xs font-semibold underline-offset-2 group-hover:underline">Review</span>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          }

          const { item, reason } = entry;
          return (
            <li key={item.id} className="w-[16.5rem] shrink-0 sm:w-[18rem]">
              <Link
                to={projectRoutes.workItem(item.board.projectId, item.id)}
                className="block h-full rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                data-testid={`attention-item-${item.id}`}
              >
                <Card tone={REASON_TONE[reason]} className="flex h-full flex-col gap-3 p-3.5 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-xs opacity-80">{item.board.issueKey}</p>
                    <StatusBadge
                      status={reason}
                      tone={REASON_BADGE_TONE[reason]}
                      label={ATTENTION_REASON_LABEL[reason]}
                    />
                  </div>
                  <p className="line-clamp-2 flex-1 text-sm font-semibold leading-5">{item.title}</p>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <p className="text-xs opacity-75">Updated {timeAgo(item.updatedAt)}</p>
                    <span className="text-xs font-semibold">Open</span>
                  </div>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ProjectSyncState({ board }: { board: BoardHealth }) {
  return (
    <Card title="Sync state" description="Reported by the boards API for this project." hierarchy="secondary">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-on-surface-variant">Status</dt>
          <dd className="mt-1">
            <StatusBadge status={board.state} label={humanize(board.state)} />
          </dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">Last sync</dt>
          <dd className="mt-1 text-on-surface">{timeAgo(board.lastSyncAt)}</dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">Active issues</dt>
          <dd className="mt-1 text-on-surface">{board.activeIssues}</dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">AI readiness</dt>
          <dd className="mt-1 text-on-surface">{humanize(board.aiReadiness)}</dd>
        </div>
      </dl>
    </Card>
  );
}
