import { useMemo, useState } from 'react';
import { Compass, Plus, RefreshCw } from 'lucide-react';
import { api } from '@shared/api';
import type { ApprovalItem, BoardHealth, WorkItem } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import { Button, CapabilityGate, PageContainer, PageHeader } from '../components/ui';
import { ConnectProjectModal, ProjectRow } from '../components/projects';
import { readDemoSession } from '../lib/session';
import { countAttention } from '../lib/workQueue';
import { projectRoutes } from '../lib/projectRoutes';
import { useNavigate, useSearchParams } from 'react-router-dom';

async function loadProjectsIndex(): Promise<{
  boards: BoardHealth[];
  workItems: WorkItem[];
  approvals: ApprovalItem[];
}> {
  const [boards, workItems, approvals] = await Promise.all([
    api.listBoards(),
    api.listWorkItems(),
    api.listApprovals().catch(() => [] as ApprovalItem[]),
  ]);
  return { boards, workItems, approvals };
}

export default function Projects() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = (searchParams.get('q') ?? '').trim().toLowerCase();
  const canManage = ['root', 'owner'].includes(readDemoSession()?.role ?? '');
  const { data, loading, error, reload } = useAsync(() => loadProjectsIndex(), []);
  const [connectOpen, setConnectOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [boardName, setBoardName] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const visibleBoards = useMemo(() => {
    if (!data) return [];
    if (!searchQuery) return data.boards;
    return data.boards.filter(
      (b) =>
        b.name.toLowerCase().includes(searchQuery) ||
        b.projectId.toLowerCase().includes(searchQuery),
    );
  }, [data, searchQuery]);

  const countsByProject = useMemo(() => {
    const map = new Map<string, ReturnType<typeof countAttention>>();
    if (!data) return map;
    for (const board of data.boards) {
      const items = data.workItems.filter((w) => w.board.projectId === board.projectId);
      map.set(board.projectId, countAttention(items, data.approvals));
    }
    return map;
  }, [data]);

  const connect = async () => {
    if (!projectId.trim() || !boardName.trim()) {
      setActionError('Project ID and name are required.');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const board = await api.connectBoard({ projectId: projectId.trim(), name: boardName.trim() });
      setConnectOpen(false);
      setProjectId('');
      setBoardName('');
      reload();
      navigate(projectRoutes.project(board.projectId));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Connect failed');
    } finally {
      setBusy(false);
    }
  };

  const syncOne = async (id: string) => {
    setSyncingId(id);
    setActionError(null);
    try {
      await api.syncBoard(id);
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const syncAll = async () => {
    if (!data?.boards.length) return;
    setBusy(true);
    setActionError(null);
    try {
      for (const board of data.boards) {
        await api.syncBoard(board.projectId);
      }
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer className="flex flex-col gap-xl" data-testid="boards-page">
      <PageHeader
        title="Projects"
        description="Connect Jira projects to triage work, review AI drafts, and manage approvals."
        actions={
          <CapabilityGate allowed={canManage}>
            <Button
              variant="secondary"
              loading={busy}
              disabled={!data?.boards.length}
              onClick={syncAll}
              data-testid="boards-sync-all"
            >
              <RefreshCw size={16} /> Sync all
            </Button>
            <Button onClick={() => setConnectOpen(true)} data-testid="boards-connect-open">
              <Plus size={16} /> Connect project
            </Button>
          </CapabilityGate>
        }
      />
      {!canManage && (
        <p className="rounded-card border border-butter/20 bg-butter-container px-3 py-2 text-sm text-on-butter-container">
          Your role can review work, but cannot connect or sync projects.
        </p>
      )}

      {actionError && !connectOpen && (
        <p className="font-body-sm text-body-sm text-error" data-testid="boards-action-error">
          {actionError}
        </p>
      )}

      {loading && <LoadingState label="Loading projects…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && data && data.boards.length === 0 && (
        <EmptyState
          icon={<Compass size={22} />}
          title="No projects connected"
          body="Finish connecting your tools, then connect a Jira project to sync work into 100x."
        />
      )}
      {!loading && !error && data && data.boards.length > 0 && visibleBoards.length === 0 && (
        <EmptyState
          icon={<Compass size={22} />}
          title="No matching projects"
          body={`Nothing matched “${searchParams.get('q') ?? ''}”. Try another name or project key.`}
        />
      )}

      {!loading && !error && visibleBoards.length > 0 && (
        <div className="flex flex-col gap-3" data-testid="projects-list">
          {visibleBoards.map((board) => (
            <ProjectRow
              key={board.projectId}
              board={board}
              counts={countsByProject.get(board.projectId) ?? countAttention([])}
              canManage={canManage}
              syncing={syncingId === board.projectId}
              onSync={() => void syncOne(board.projectId)}
            />
          ))}
        </div>
      )}

      {connectOpen && (
        <ConnectProjectModal
          projectId={projectId}
          boardName={boardName}
          busy={busy}
          error={actionError}
          onProjectIdChange={setProjectId}
          onBoardNameChange={setBoardName}
          onClose={() => {
            setConnectOpen(false);
            setActionError(null);
          }}
          onSubmit={() => void connect()}
        />
      )}
    </PageContainer>
  );
}
