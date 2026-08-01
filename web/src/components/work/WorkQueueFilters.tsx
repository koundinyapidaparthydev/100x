import { Link } from 'react-router-dom';
import {
  WORK_QUEUE_FILTERS,
  type WorkQueueFilter,
  workQueueHref,
} from '../../lib/workQueue';
import { chipClassName } from '../ui';
import { cn } from '../../lib/utils';

export interface WorkQueueFiltersProps {
  projectId: string;
  active: WorkQueueFilter;
  counts?: Partial<Record<WorkQueueFilter, number>>;
}

export function WorkQueueFilters({ projectId, active, counts }: WorkQueueFiltersProps) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="tablist"
      aria-label="Work queue filters"
      data-testid="work-queue-filters"
    >
      {WORK_QUEUE_FILTERS.map((filter) => {
        const selected = filter.id === active;
        const count = counts?.[filter.id];
        return (
          <Link
            key={filter.id}
            role="tab"
            aria-selected={selected}
            to={workQueueHref(projectId, filter.id)}
            data-testid={`work-filter-${filter.id}`}
            className={chipClassName({
              tone: 'primary',
              selected,
              className: 'no-underline',
            })}
          >
            <span>{filter.label}</span>
            {typeof count === 'number' && (
              <span
                className={cn(
                  'inline-flex min-w-5 items-center justify-center rounded-chip px-1.5 text-xs font-semibold',
                  selected ? 'bg-white/20' : 'bg-surface-bright/70 text-on-surface-variant',
                )}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
