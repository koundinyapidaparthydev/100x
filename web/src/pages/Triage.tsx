import { useMemo, useState } from 'react';
import { Bot, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api';
import type { BoardHealth, WorkItem } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import { humanize, timeAgo } from '../lib/format';
import { Button, Chip, PageContainer, PageHeader, StatusBadge } from '../components/ui';
import { readDemoSession } from '../lib/session';
import { cn } from '../lib/utils';

type PriorityFilter = 'all' | 'urgent' | 'medium' | 'low';

function priorityRank(priority: WorkItem['priority']): number {
  if (priority === 'critical') return 0;
  if (priority === 'high') return 1;
  if (priority === 'medium') return 2;
  return 3;
}

function priorityTone(priority: WorkItem['priority']): 'neutral' | 'info' | 'warning' | 'danger' {
  if (priority === 'critical' || priority === 'high') return 'danger';
  if (priority === 'medium') return 'warning';
  return 'neutral';
}

/** Estimate how much of the ticket AI can likely finish before human review. */
export function estimateTargetPercent(item: WorkItem): number {
  let score = 28;
  if (item.priority === 'critical') score = 14;
  else if (item.priority === 'high') score = 20;
  else if (item.priority === 'medium') score = 30;
  else score = 40;

  const hard = ['security', 'auth', 'pii', 'infra', 'migration', 'compliance', 'credential'];
  const soft = ['docs', 'copy', 'ui', 'a11y', 'accessibility', 'frontend'];
  const labels = item.labels.map((label) => label.toLowerCase());
  if (labels.some((label) => hard.some((token) => label.includes(token)))) score -= 6;
  if (labels.some((label) => soft.some((token) => label.includes(token)))) score += 6;

  const body = `${item.title} ${item.description}`.toLowerCase();
  if (/(ssn|secret|credential|pii|auth|security)/.test(body)) score -= 5;
  if (/(test|docs|copy|typo|style)/.test(body)) score += 4;
  if (item.description.length > 420) score -= 4;
  if (item.description.length < 140) score += 4;

  return Math.max(10, Math.min(50, Math.round(score / 5) * 5));
}

async function loadTriage(triagePending: boolean): Promise<{ items: WorkItem[]; boards: BoardHealth[] }> {
  const [items, boards] = await Promise.all([
    api.listWorkItems(triagePending ? { triagePending: true } : undefined),
    api.listBoards(),
  ]);
  return { items, boards };
}

export default function Triage() {
  const canManage = ['root', 'owner', 'manager'].includes(readDemoSession()?.role ?? '');
  const [triagePending, setTriagePending] = useState(true);
  const { data, loading, error, reload } = useAsync(
    () => loadTriage(triagePending),
    [triagePending],
  );
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const projects = useMemo(() => {
    const ids = new Set<string>();
    for (const item of data?.items ?? []) ids.add(item.board.projectId);
    for (const board of data?.boards ?? []) ids.add(board.projectId);
    return [...ids].sort();
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.items ?? [])
      .filter((item) => {
        if (projectFilter !== 'all' && item.board.projectId !== projectFilter) return false;
        if (priorityFilter === 'urgent' && item.priority !== 'critical' && item.priority !== 'high') {
          return false;
        }
        if (priorityFilter === 'medium' && item.priority !== 'medium') return false;
        if (priorityFilter === 'low' && item.priority !== 'low') return false;
        if (!q) return true;
        const hay = `${item.board.issueKey} ${item.title} ${item.description} ${item.labels.join(' ')}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.updatedAt.localeCompare(a.updatedAt));
  }, [data, projectFilter, priorityFilter, search]);

  const triage = async (item: WorkItem, aiFirst: boolean) => {
    setBusyId(item.id);
    setActionError(null);
    setNotice(null);
    try {
      const percent = estimateTargetPercent(item);
      await api.triageWorkItem(
        item.id,
        aiFirst ? { aiFirst: true, targetCompletionPercent: percent } : { aiFirst: false },
      );
      setNotice(
        aiFirst
          ? `Queued AI-first for ${item.board.issueKey} (~${percent}% estimate — not a guarantee).`
          : `Assigned ${item.board.issueKey} to human-first.`,
      );
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Triage failed');
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !data) {
    return (
      <PageContainer className="flex min-h-[50vh] items-center justify-center">
        <LoadingState label="Loading triage deck…" />
      </PageContainer>
    );
  }

  if (error && !data) {
    return (
      <PageContainer>
        <ErrorState message={error} onRetry={reload} />
      </PageContainer>
    );
  }

  return (
    <PageContainer data-testid="triage-page" width="operational">
      <PageHeader
        eyebrow="Manager decision"
        title="Triage"
        description="Pick AI-first or human-first for pending tickets. Completion % is an estimate for the AI draft — a human always reviews before merge."
        actions={
          <Button type="button" variant="secondary" onClick={() => reload()} data-testid="triage-refresh">
            Refresh
          </Button>
        }
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs font-medium text-on-surface-variant">
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Key, title, label…"
            data-testid="triage-search"
            className="h-10 rounded-lg border border-outline-variant bg-surface px-3 text-sm text-on-surface"
          />
        </label>
        <label className="flex min-w-[8rem] flex-col gap-1 text-xs font-medium text-on-surface-variant">
          Project
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            data-testid="triage-project-filter"
            className="h-10 rounded-lg border border-outline-variant bg-surface px-3 text-sm text-on-surface"
          >
            <option value="all">All projects</option>
            {projects.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-1.5" data-testid="triage-pending-filter">
          <Chip
            tone="primary"
            selected={triagePending}
            onClick={() => setTriagePending(true)}
            data-testid="triage-filter-pending"
          >
            Needs triage
          </Chip>
          <Chip
            tone="primary"
            selected={!triagePending}
            onClick={() => setTriagePending(false)}
            data-testid="triage-filter-all"
          >
            All items
          </Chip>
        </div>
        <div className="flex flex-wrap gap-1.5" data-testid="triage-priority-filters">
          {(
            [
              ['all', 'All'],
              ['urgent', 'Urgent'],
              ['medium', 'Medium'],
              ['low', 'Low'],
            ] as const
          ).map(([id, label]) => (
            <Chip
              key={id}
              selected={priorityFilter === id}
              onClick={() => setPriorityFilter(id)}
              data-testid={`triage-priority-${id}`}
            >
              {label}
            </Chip>
          ))}
        </div>
      </div>

      <p className="mt-3 text-sm text-on-surface-variant" data-testid="triage-count">
        {filtered.length} {triagePending ? 'triage-pending' : 'matching'}
        {projectFilter !== 'all' ? ` · ${projectFilter}` : ''}
      </p>

      {notice && (
        <p className="mt-2 text-sm text-success" role="status" data-testid="triage-notice">
          {notice}
        </p>
      )}
      {actionError && (
        <p className="mt-2 text-sm text-error" role="alert" data-testid="triage-action-error">
          {actionError}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Nothing waiting for triage"
            body="Fresh Jira syncs and new issues show up here when they still need an AI vs human decision."
          />
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="triage-card-deck">
          {filtered.map((item) => {
            const estimate = estimateTargetPercent(item);
            const busy = busyId === item.id;
            const needsReview = item.aiStatus === 'ready_for_human';
            return (
              <li
                key={item.id}
                data-testid={`triage-card-${item.board.issueKey}`}
                className={cn(
                  'flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container p-4',
                  (item.priority === 'critical' || item.priority === 'high') &&
                    'border-error/30 bg-error/5',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to={`/projects/${encodeURIComponent(item.board.projectId)}/work/${encodeURIComponent(item.id)}`}
                      className="font-mono text-xs font-semibold text-primary hover:underline"
                      data-testid={`triage-issue-${item.board.issueKey}`}
                    >
                      {item.board.issueKey}
                    </Link>
                    <h3 className="mt-1 text-base font-semibold text-on-surface">{item.title}</h3>
                  </div>
                  <StatusBadge
                    status={item.priority}
                    tone={priorityTone(item.priority)}
                    label={humanize(item.priority)}
                  />
                </div>

                <p className="line-clamp-3 text-sm text-on-surface-variant">
                  {item.description || 'No description'}
                </p>

                <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                  <span>{item.board.projectId}</span>
                  <span aria-hidden="true">·</span>
                  <span>Updated {timeAgo(item.updatedAt)}</span>
                  {item.labels.slice(0, 3).map((label) => (
                    <StatusBadge key={label} status={label} label={label} />
                  ))}
                </div>

                <div
                  className="rounded-lg border border-outline-variant/80 bg-surface px-3 py-2 text-sm text-on-surface"
                  data-testid={`triage-estimate-${item.board.issueKey}`}
                >
                  <span className="font-semibold">~{estimate}% estimate</span>
                  <span className="text-on-surface-variant">
                    {' '}
                    — AI draft target, not a completion guarantee. Needs human review before ship.
                  </span>
                  {needsReview && (
                    <p className="mt-1 font-medium text-warning" data-testid="triage-needs-review">
                      Already marked ready for human review.
                    </p>
                  )}
                </div>

                <div className="mt-auto flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!canManage || busy}
                    loading={busy}
                    data-testid={`triage-human-${item.board.issueKey}`}
                    onClick={() => void triage(item, false)}
                  >
                    <UserRound size={16} />
                    Human-first
                  </Button>
                  <Button
                    type="button"
                    disabled={!canManage || busy}
                    loading={busy}
                    data-testid={`triage-ai-${item.board.issueKey}`}
                    onClick={() => void triage(item, true)}
                  >
                    <Bot size={16} />
                    AI-first
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
