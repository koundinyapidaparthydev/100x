import { Activity, Inbox } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '@shared/api';
import type { AiJob, AiJobState } from '@shared/types';
import { cn } from '../lib/utils';
import { useAsync } from '../lib/useAsync';
import { formatTokens } from '../lib/format';
import { jobStateChip } from '../lib/chips';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import { TrustStrip } from '../components/TrustStrip';

/** Group display order — live work first (running, queued), then pipeline stages, then terminal states. */
const GROUP_ORDER: AiJobState[] = [
  'running',
  'queued',
  'sanitizing',
  'enriching_mcp',
  'packaging',
  'attaching',
  'ready_for_human',
  'blocked_pii',
  'failed',
  'cancelled',
];

export function Jobs() {
  const navigate = useNavigate();
  const jobsQuery = useAsync(() => api.listJobs());
  const statsQuery = useAsync(() => api.stats());

  const loading = jobsQuery.loading || statsQuery.loading;
  const error = jobsQuery.error ?? statsQuery.error;
  const retry = () => {
    jobsQuery.retry();
    statsQuery.retry();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingState label="Loading AI jobs…" />
      </div>
    );
  }

  if (error || !jobsQuery.data) {
    return (
      <div className="flex items-center justify-center h-full">
        <ErrorState error={error} onRetry={retry} />
      </div>
    );
  }

  const stats = statsQuery.data;
  const jobs = jobsQuery.data;
  const groups = GROUP_ORDER.map((state) => ({
    state,
    jobs: jobs.filter((j) => j.state === state),
  })).filter((g) => g.jobs.length > 0);

  return (
    <div className="flex flex-col px-4 py-4 gap-4 max-w-md mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-on-background">AI Jobs</h1>
        <p className="font-body-sm text-on-surface-variant">
          Queued, running, ready, and blocked AI work across your Jira projects.
        </p>
      </div>

      {/* Compact stats header */}
      {stats && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-surface-container-low rounded-lg border border-outline-variant p-3">
              <div className="font-headline-sm text-tertiary">{stats.activeJobs}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                Active
              </div>
            </div>
            <div className="bg-surface-container-low rounded-lg border border-outline-variant p-3">
              <div className="font-headline-sm text-secondary">{stats.queuedJobs}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                Queued
              </div>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                Token budget used today
              </span>
              <span className="font-mono text-xs text-on-surface">
                {formatTokens(stats.tokenUsageToday.total)} / {formatTokens(stats.tokenBudget)} •{' '}
                {Math.round(stats.tokenBudgetUsedPercent)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  stats.tokenBudgetUsedPercent >= 90 ? 'bg-error' : stats.tokenBudgetUsedPercent >= 70 ? 'bg-warning' : 'bg-primary',
                )}
                style={{ width: `${Math.min(100, stats.tokenBudgetUsedPercent)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Job groups */}
      {groups.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No AI jobs yet"
          body="Swipe a ticket AI-first in triage to enqueue the first job."
        />
      ) : (
        groups.map((group) => {
          const chip = jobStateChip(group.state);
          return (
            <section key={group.state} className="flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-outline-variant pb-1">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold">
                  {chip.label}
                </h2>
                <span className="font-mono text-[10px] text-on-surface-variant">{group.jobs.length}</span>
              </div>
              {group.jobs.map((job) => (
                <JobRow key={job.id} job={job} onOpen={() => navigate(`/app/ticket/${job.workItemId}`)} />
              ))}
            </section>
          );
        })
      )}

      <TrustStrip className="border-t border-outline-variant mt-2 pt-4" />
    </div>
  );
}

function JobRow({ job, onOpen }: { job: AiJob; onOpen: () => void }) {
  const chip = jobStateChip(job.state);
  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-surface-container-lowest border border-outline-variant rounded-xl p-3 flex items-center gap-3 hover:bg-surface-container-low active:scale-[0.99] transition-all"
    >
      <Activity className="w-4 h-4 text-on-surface-variant shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-on-surface font-semibold truncate">{job.id}</span>
          <span className={cn('px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-widest shrink-0', chip.className)}>
            {chip.label}
          </span>
        </div>
        <div className="font-mono text-[10px] text-on-surface-variant mt-0.5 truncate">
          Ticket {job.workItemId} • {formatTokens(job.tokenUsage.total)} tokens
        </div>
      </div>
    </button>
  );
}
