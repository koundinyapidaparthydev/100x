import { useMemo, useState } from 'react';
import { CheckSquare } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { api } from '@shared/api';
import type { ApprovalItem, WorkItem } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import { humanize } from '../lib/format';
import { PageContainer, PageHeader, StatusBadge } from '../components/ui';
import { ApprovalCard } from '../components/work';
import { readDemoSession } from '../lib/session';
import { enrichApprovals, filterApprovalsForProject, findBoard } from '../lib/workQueue';
import type { BoardHealth } from '@shared/types';

async function loadApprovalsWorkspace(projectId?: string): Promise<{
  approvals: ApprovalItem[];
  workItems: WorkItem[];
  boards: BoardHealth[];
}> {
  const [approvals, workItems, boards] = await Promise.all([
    api.listApprovals(),
    projectId ? api.listWorkItems({ projectId }) : api.listWorkItems(),
    api.listBoards(),
  ]);
  return { approvals, workItems, boards };
}

export default function Approvals() {
  const { projectId } = useParams<{ projectId?: string }>();
  const { data, loading, error, reload } = useAsync(() => loadApprovalsWorkspace(projectId), [projectId]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const canDecide = ['founder', 'manager'].includes(readDemoSession()?.role ?? '');

  const enriched = useMemo(() => {
    if (!data) return [];
    return filterApprovalsForProject(enrichApprovals(data.approvals, data.workItems), projectId);
  }, [data, projectId]);

  const boardName = useMemo(() => {
    if (!projectId || !data) return null;
    return findBoard(data.boards, projectId)?.name ?? projectId;
  }, [data, projectId]);

  const decide = async (item: ApprovalItem, decision: 'approved' | 'rejected') => {
    setActionError(null);
    setBusyId(item.id);
    try {
      await api.decideApproval(item.id, decision);
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Decision failed');
    } finally {
      setBusyId(null);
    }
  };

  const pending = enriched.filter((a) => a.status === 'pending');
  const decided = enriched.filter((a) => a.status !== 'pending');

  return (
    <PageContainer className="flex flex-col gap-xl" data-testid="approvals-page">
      <PageHeader
        eyebrow={projectId ? boardName ?? projectId : 'Organization'}
        title={projectId ? 'Project approvals' : 'Approvals'}
        description="Review exception requests. Decisions are record-only: this service records approval or rejection but does not enact the requested exception."
      />
      {!canDecide && (
        <p className="rounded-card border border-butter/20 bg-butter-container px-3 py-2 text-sm text-on-butter-container">
          Your role can review these records but cannot decide them.
        </p>
      )}

      {actionError && (
        <p className="font-body-sm text-body-sm text-error" data-testid="approvals-error">
          {actionError}
        </p>
      )}

      {loading && <LoadingState label="Loading approvals…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && enriched.length === 0 && (
        <EmptyState
          icon={<CheckSquare size={22} />}
          title="Nothing to approve"
          body={
            projectId
              ? 'No approval requests are linked to work items in this project.'
              : 'High-risk AI actions that need a manager sign-off will appear here.'
          }
        />
      )}

      {!loading && !error && pending.length > 0 && (
        <div className="flex flex-col gap-md" data-testid="approvals-pending-list">
          {pending.map((item) => (
            <ApprovalCard
              key={item.id}
              item={item}
              canDecide={canDecide}
              busy={busyId === item.id}
              showProject={!projectId}
              onDecide={decide}
            />
          ))}
        </div>
      )}

      {!loading && !error && decided.length > 0 && (
        <div className="flex flex-col gap-md" data-testid="approvals-decided-list">
          <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Decided</h3>
          {decided.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-md rounded-card border border-outline-variant/70 bg-surface p-3 shadow-xs"
            >
              <div className="min-w-0">
                <p className="truncate font-body-sm text-body-sm text-on-surface">{item.title}</p>
                <p className="mt-1 font-mono text-xs text-on-surface-variant">
                  {item.workItem
                    ? `${item.workItem.board.projectId} · ${item.workItem.board.issueKey}`
                    : item.workItemId}
                </p>
              </div>
              <StatusBadge status={item.status} label={`${humanize(item.status)} · record only`} />
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
