import { Link } from 'react-router-dom';
import type { WorkItem } from '@shared/types';
import { ResponsiveDataList, StatusBadge } from '../ui';
import { timeAgo } from '../../lib/format';
import { type WorkQueueFilter, workItemHref, workQueueHref } from '../../lib/workQueue';

export interface WorkItemListProps {
  items: WorkItem[];
  filter?: WorkQueueFilter;
}

function StatusDot({ status }: { status: string }) {
  const tone =
    status === 'blocked_pii' || status === 'failed'
      ? 'bg-blush'
      : status === 'ready_for_human'
        ? 'bg-mint'
        : status === 'queued' || status === 'running'
          ? 'bg-butter'
          : 'bg-outline-variant';
  return <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${tone}`} aria-hidden="true" />;
}

export function WorkItemList({ items, filter }: WorkItemListProps) {
  return (
    <ResponsiveDataList
      items={items}
      getKey={(item) => item.id}
      caption="Work items in this project"
      getRowHref={(item) => workItemHref(item, filter)}
      columns={[
        {
          key: 'key',
          label: 'Key',
          className: 'w-[7.5rem]',
          render: (item) => (
            <span className="inline-flex items-center gap-2 font-mono text-[13px] font-semibold" data-testid={`work-item-link-${item.id}`}>
              <StatusDot status={item.aiStatus} />
              {item.board.issueKey}
            </span>
          ),
        },
        {
          key: 'title',
          label: 'Title',
          render: (item) => <span className="block truncate text-[13px]">{item.title}</span>,
        },
        {
          key: 'ai',
          label: 'AI status',
          className: 'w-36',
          render: (item) => <StatusBadge status={item.aiStatus} className="max-w-full truncate" />,
        },
        {
          key: 'decision',
          label: 'Decision',
          className: 'w-32',
          render: (item) =>
            item.lastTriageDecision ? (
              <StatusBadge status={item.lastTriageDecision === 'ai_first' ? 'ai' : 'human'} />
            ) : (
              <StatusBadge status="pending" label="Needs triage" />
            ),
        },
        {
          key: 'updated',
          label: 'Updated',
          className: 'w-24 whitespace-nowrap text-xs text-on-surface-variant',
          render: (item) => timeAgo(item.updatedAt),
        },
      ]}
      renderMobile={(item) => (
        <div className="flex gap-2.5">
          <StatusDot status={item.aiStatus} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-on-surface-variant">{item.board.issueKey}</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-on-surface">{item.title}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <StatusBadge status={item.aiStatus} />
              {item.lastTriageDecision ? (
                <StatusBadge status={item.lastTriageDecision === 'ai_first' ? 'ai' : 'human'} />
              ) : (
                <StatusBadge status="pending" label="Needs triage" />
              )}
            </div>
            <p className="mt-1.5 text-xs text-on-surface-variant">Updated {timeAgo(item.updatedAt)}</p>
          </div>
        </div>
      )}
    />
  );
}

export function WorkItemReturnLink({
  projectId,
  filter,
}: {
  projectId: string;
  filter?: WorkQueueFilter;
}) {
  return (
    <Link
      to={workQueueHref(projectId, filter)}
      className="text-sm font-semibold text-primary hover:underline"
      data-testid="work-item-return"
    >
      ← Back to work queue
    </Link>
  );
}
