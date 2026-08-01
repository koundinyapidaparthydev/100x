import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { api } from '@shared/api';
import type { ApprovalItem, AuditEvent, BoardHealth, WorkItem } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import { ErrorState, LoadingState } from '../components/AsyncStates';
import { Button, CapabilityGate, PageContainer, PageHeader } from '../components/ui';
import { AttentionQueue, ProjectRecentActivity, ProjectSyncState } from '../components/projects';
import { readDemoSession } from '../lib/session';
import { countAttention, filterAuditForProject, findBoard } from '../lib/workQueue';
import { projectRoutes } from '../lib/projectRoutes';
import { formatNumber } from '../lib/format';

async function loadProjectOverview(projectId: string): Promise<{
  boards: BoardHealth[];
  workItems: WorkItem[];
  approvals: ApprovalItem[];
  events: AuditEvent[];
}> {
  const [boards, workItems, approvals, events] = await Promise.all([
    api.listBoards(),
    api.listWorkItems({ projectId }),
    api.listApprovals().catch(() => [] as ApprovalItem[]),
    api.listAuditEvents().catch(() => [] as AuditEvent[]),
  ]);
  return { boards, workItems, approvals, events };
}

export default function ProjectOverview() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const canManage = ['founder', 'manager'].includes(readDemoSession()?.role ?? '');
  const { data, loading, error, reload } = useAsync(() => loadProjectOverview(projectId), [projectId]);
  const [syncing, setSyncing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const board = useMemo(() => (data ? findBoard(data.boards, projectId) : undefined), [data, projectId]);
  const counts = useMemo(
    () => (data ? countAttention(data.workItems, data.approvals) : null),
    [data],
  );
  const activity = useMemo(
    () => (data ? filterAuditForProject(data.events, projectId, data.workItems) : []),
    [data, projectId],
  );

  const sync = async () => {
    setSyncing(true);
    setActionError(null);
    try {
      await api.syncBoard(projectId);
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <PageContainer className="flex min-h-[40vh] items-center justify-center">
        <LoadingState label="Loading project…" />
      </PageContainer>
    );
  }

  if (error || !data) {
    return (
      <PageContainer>
        <ErrorState message={error ?? 'Project not found'} onRetry={reload} />
      </PageContainer>
    );
  }

  if (!board) {
    return (
      <PageContainer className="flex flex-col gap-4">
        <PageHeader title={projectId} description="This project is not in the connected boards list." />
        <Link to={projectRoutes.projects} className="text-sm font-semibold text-primary hover:underline">
          ← Back to projects
        </Link>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Project workspace"
        title={<span data-testid="dashboard-heading">{board.name}</span>}
        description={`${board.issuePrefix} · ${board.projectId}. Process the attention queue, then review sync state and recent activity.`}
        actions={
          <>
            <Link
              to={projectRoutes.work(projectId)}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-outline-variant bg-surface px-4 text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Work queue
            </Link>
            <Link
              to={projectRoutes.approvals(projectId)}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-outline-variant bg-surface px-4 text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Approvals{counts && counts.approvals > 0 ? ` (${formatNumber(counts.approvals)})` : ''}
            </Link>
            <CapabilityGate allowed={canManage}>
              <Button variant="secondary" loading={syncing} onClick={() => void sync()} data-testid={`board-sync-${projectId}`}>
                <RefreshCw size={16} /> Sync
              </Button>
            </CapabilityGate>
          </>
        }
      />

      {actionError && <p className="text-sm text-error">{actionError}</p>}

      {counts && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ['Needs attention', counts.attention, `${projectRoutes.work(projectId)}?filter=attention`, 'surface-butter'],
              ['Needs triage', counts.triage, `${projectRoutes.work(projectId)}?filter=triage`, 'surface-butter'],
              ['Ready for review', counts.review, `${projectRoutes.work(projectId)}?filter=review`, 'surface-mint'],
              ['Blocked', counts.blocked, `${projectRoutes.work(projectId)}?filter=blocked`, 'surface-blush'],
            ] as const
          ).map(([label, value, to, surface]) => (
            <Link
              key={label}
              to={to}
              className={`rounded-card border border-transparent p-3.5 shadow-xs transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${surface}`}
            >
              <p className="text-sm opacity-80">{label}</p>
              <p className="mt-1.5 text-2xl font-semibold tracking-tight">{formatNumber(value)}</p>
            </Link>
          ))}
        </div>
      )}

      <AttentionQueue projectId={projectId} workItems={data.workItems} approvals={data.approvals} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ProjectSyncState board={board} />
        <ProjectRecentActivity projectId={projectId} events={activity} />
      </div>
    </PageContainer>
  );
}
