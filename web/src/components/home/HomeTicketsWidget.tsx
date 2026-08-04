import { Link } from 'react-router-dom';
import type { WorkItem } from '@shared/types';
import { Button, Card, StatusBadge } from '../ui';
import { humanize, timeAgo } from '../../lib/format';
import { projectRoutes } from '../../lib/projectRoutes';
import { attentionReason, sortAttentionItems } from '../../lib/workQueue';

export type HomeTicketsWidgetProps = {
  workItems: WorkItem[];
  busyId: string | null;
  onWorkOn: (item: WorkItem) => void;
  onDraftSolution: (item: WorkItem) => void;
  limit?: number;
};

export function HomeTicketsWidget({
  workItems,
  busyId,
  onWorkOn,
  onDraftSolution,
  limit = 8,
}: HomeTicketsWidgetProps) {
  const items = sortAttentionItems(workItems).slice(0, limit);
  const fallback = items.length === 0 ? workItems.slice(0, limit) : items;

  return (
    <Card
      title="Tickets"
      description="Board work needing attention in this environment."
      data-testid="home-tickets-widget"
    >
      {fallback.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          No tickets yet. Connect a board under{' '}
          <Link to="/connections" className="font-semibold text-primary hover:underline">
            Connections
          </Link>{' '}
          or open{' '}
          <Link to="/projects" className="font-semibold text-primary hover:underline">
            Projects
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-outline-variant">
          {fallback.map((item) => {
            const reason = attentionReason(item);
            return (
              <li key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <Link
                    to={projectRoutes.workItem(item.board.projectId, item.id)}
                    className="truncate text-sm font-semibold text-on-surface hover:text-primary"
                    data-testid={`home-ticket-${item.id}`}
                  >
                    {item.board.issueKey}: {item.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    {humanize(item.status)}
                    {reason ? ` · ${reason}` : ''}
                    {item.updatedAt ? ` · ${timeAgo(item.updatedAt)}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={item.aiStatus} />
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-8 px-3 py-1.5 text-xs"
                    disabled={busyId === item.id}
                    data-testid={`home-ticket-work-${item.id}`}
                    onClick={() => onWorkOn(item)}
                  >
                    Work on
                  </Button>
                  <Button
                    type="button"
                    variant="quiet"
                    className="min-h-8 px-3 py-1.5 text-xs"
                    disabled={busyId === item.id}
                    data-testid={`home-ticket-draft-${item.id}`}
                    onClick={() => onDraftSolution(item)}
                  >
                    Draft solution
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
