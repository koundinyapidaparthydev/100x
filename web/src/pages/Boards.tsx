import { useMemo, useState } from 'react';
import { AlertTriangle, Compass, Filter, Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api';
import type { BoardHealth, WorkItem } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import Chip, { type ChipTone } from '../components/Chip';
import { formatNumber, humanize, timeAgo } from '../lib/format';

const BOARD_STATE: Record<BoardHealth['state'], { tone: ChipTone; pulse?: boolean; label: string }> = {
  healthy: { tone: 'tertiary', label: 'Healthy' },
  syncing: { tone: 'primary', pulse: true, label: 'Syncing' },
  error: { tone: 'error', label: 'Error' },
  queued: { tone: 'surface', label: 'Queued' },
};

const READINESS: Record<BoardHealth['aiReadiness'], { filled: number; bar: string; text: string }> = {
  optimal: { filled: 4, bar: 'bg-tertiary', text: 'text-tertiary' },
  evaluating: { filled: 2, bar: 'bg-primary', text: 'text-primary' },
  partial: { filled: 2, bar: 'bg-secondary', text: 'text-secondary' },
  blocked: { filled: 1, bar: 'bg-error', text: 'text-error' },
};

const AI_STATUS_TONE: Record<WorkItem['aiStatus'], ChipTone> = {
  none: 'surface',
  queued: 'surface',
  running: 'tertiary',
  ready_for_human: 'primary',
  blocked_pii: 'warning',
  failed: 'error',
  cancelled: 'surface',
};

const inputClass =
  'w-full h-9 bg-surface-variant border border-outline-variant/50 rounded text-body-sm text-on-surface px-3 outline-none focus:border-outline-variant';

export default function Boards() {
  const { data: boards, loading, error, reload } = useAsync(() => api.listBoards(), []);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [connectOpen, setConnectOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [boardName, setBoardName] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const effectiveSelected =
    selectedProjectId ??
    boards?.find((b) => b.connected)?.projectId ??
    boards?.[0]?.projectId ??
    null;

  const items = useAsync(
    () => (effectiveSelected ? api.listWorkItems({ projectId: effectiveSelected }) : Promise.resolve([])),
    [effectiveSelected],
  );

  const filteredBoards = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (boards ?? []).filter((b) => {
      if (!q) return true;
      return [b.projectId, b.name, b.issuePrefix].join(' ').toLowerCase().includes(q);
    });
  }, [boards, filter]);

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
      setSelectedProjectId(board.projectId);
      reload();
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
      items.reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const syncAll = async () => {
    if (!boards?.length) return;
    setBusy(true);
    setActionError(null);
    try {
      for (const board of boards) {
        await api.syncBoard(board.projectId);
      }
      reload();
      items.reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-container-max mx-auto p-margin flex flex-col gap-xl" data-testid="boards-page">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-semibold text-on-surface">Jira Sync Health</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-sm max-w-2xl">
            Monitor real-time synchronization status and AI delegation readiness across connected project boards.
          </p>
        </div>
        <div className="flex gap-md">
          <button
            type="button"
            disabled={busy || !boards?.length}
            onClick={syncAll}
            data-testid="boards-sync-all"
            className="px-md py-sm rounded border border-outline-variant text-on-surface font-label-md text-label-md flex items-center gap-xs hover:bg-surface-variant transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            Sync All
          </button>
          <button
            type="button"
            onClick={() => setConnectOpen(true)}
            data-testid="boards-connect-open"
            className="px-md py-sm rounded bg-tertiary text-on-tertiary font-label-md text-label-md flex items-center gap-xs hover:bg-tertiary-fixed transition-colors font-bold"
          >
            <Plus size={18} />
            Connect Board
          </button>
        </div>
      </div>

      {actionError && !connectOpen && (
        <p className="font-body-sm text-body-sm text-error" data-testid="boards-action-error">
          {actionError}
        </p>
      )}

      <div className="bg-surface-container rounded-lg border border-outline-variant p-sm flex items-center gap-md overflow-x-auto">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by Project Key..."
            className="w-full h-9 bg-surface-variant border border-transparent rounded focus:border-outline-variant focus:ring-0 text-body-sm text-on-surface pl-10 pr-3 placeholder-on-surface-variant outline-none"
          />
        </div>
      </div>

      {loading && <LoadingState label="Loading boards…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && boards && boards.length === 0 && (
        <EmptyState
          icon={<Compass size={22} />}
          title="No boards connected"
          body="Connect a Jira project to start syncing work items into AplifyAI."
        />
      )}

      {!loading && !error && filteredBoards.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-lg">
          {filteredBoards.map((board) => {
            const state = BOARD_STATE[board.state];
            const readiness = READINESS[board.aiReadiness];
            const selected = board.projectId === effectiveSelected;
            return (
              <button
                type="button"
                key={board.projectId}
                onClick={() => setSelectedProjectId(board.projectId)}
                data-testid={`board-card-${board.projectId}`}
                className={`text-left bg-surface-container border rounded-xl p-lg flex flex-col gap-md relative overflow-hidden group transition-colors ${
                  selected
                    ? 'border-tertiary/60 ring-1 ring-tertiary/30'
                    : board.state === 'error'
                      ? 'border-error/30 hover:border-error/50'
                      : 'border-outline-variant hover:border-outline'
                }`}
              >
                {board.state === 'error' && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-error/5 blur-3xl -z-10 rounded-full"></div>
                )}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-sm">
                    <div className="w-10 h-10 rounded bg-surface-variant flex items-center justify-center border border-outline-variant">
                      <Compass className="text-secondary" />
                    </div>
                    <div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-tertiary transition-colors">
                        {board.name}
                      </h3>
                      <p className="font-label-sm text-label-sm text-on-surface-variant font-mono">
                        {board.issuePrefix} · {board.projectId}
                      </p>
                    </div>
                  </div>
                  <Chip tone={state.tone} pulse={state.pulse}>
                    {board.state === 'error' && <AlertTriangle size={12} />}
                    {state.label}
                  </Chip>
                </div>

                <div className="grid grid-cols-2 gap-md mt-sm">
                  <div className="flex flex-col gap-xs">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Last Sync</span>
                    <span
                      className={`font-body-sm text-body-sm ${
                        board.state === 'error'
                          ? 'text-error'
                          : board.state === 'syncing'
                            ? 'text-on-surface animate-pulse'
                            : 'text-on-surface'
                      }`}
                    >
                      {board.state === 'error'
                        ? `Failed ${timeAgo(board.lastSyncAt)}`
                        : board.state === 'syncing'
                          ? 'In progress'
                          : timeAgo(board.lastSyncAt)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-xs">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Active Issues</span>
                    <span className="font-body-sm text-body-sm text-on-surface">{formatNumber(board.activeIssues)}</span>
                  </div>
                </div>

                <div className="mt-auto pt-md border-t border-outline-variant flex flex-col gap-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">AI Delegation Readiness</span>
                    <span className={`font-label-sm text-label-sm ${readiness.text}`}>{humanize(board.aiReadiness)}</span>
                  </div>
                  <div className="flex gap-1 h-1.5 w-full">
                    {[0, 1, 2, 3].map((seg) => (
                      <div
                        key={seg}
                        className={`flex-1 ${seg === 0 ? 'rounded-l-full' : ''} ${seg === 3 ? 'rounded-r-full' : ''} ${
                          seg < readiness.filled ? readiness.bar : 'bg-surface-variant'
                        }`}
                      ></div>
                    ))}
                  </div>
                  <div
                    role="presentation"
                    onClick={(e) => e.stopPropagation()}
                    className="flex justify-end pt-xs"
                  >
                    <button
                      type="button"
                      disabled={syncingId === board.projectId}
                      onClick={() => syncOne(board.projectId)}
                      data-testid={`board-sync-${board.projectId}`}
                      className="px-sm py-xs rounded border border-outline-variant text-on-surface font-label-sm text-label-sm flex items-center gap-xs hover:bg-surface-variant transition-colors disabled:opacity-50"
                    >
                      {syncingId === board.projectId ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      Sync
                    </button>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {effectiveSelected && (
        <div className="flex flex-col gap-md">
          <div className="flex items-end justify-between gap-md">
            <div>
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Work items</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs">
                Project <span className="font-mono">{effectiveSelected}</span>
              </p>
            </div>
          </div>
          {items.loading && <LoadingState label="Loading work items…" />}
          {!items.loading && items.error && <ErrorState message={items.error} onRetry={items.reload} />}
          {!items.loading && !items.error && items.data && items.data.length === 0 && (
            <EmptyState title="No work items" body="Sync this board to pull issues into AplifyAI." />
          )}
          {!items.loading && !items.error && items.data && items.data.length > 0 && (
            <div className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-variant/50 border-b border-outline-variant">
                    <th className="p-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Key</th>
                    <th className="p-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Title</th>
                    <th className="p-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">AI Status</th>
                    <th className="p-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Triage</th>
                    <th className="p-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {items.data.map((item) => (
                    <tr key={item.id} className="border-b border-outline-variant/30 hover:bg-surface-variant/30 transition-colors">
                      <td className="p-md">
                        <Link
                          to={`/boards/task/${encodeURIComponent(item.id)}`}
                          className="font-mono text-body-sm text-tertiary hover:underline"
                          data-testid={`work-item-link-${item.id}`}
                        >
                          {item.board.issueKey}
                        </Link>
                      </td>
                      <td className="p-md font-body-sm text-body-sm text-on-surface">
                        <Link
                          to={`/boards/task/${encodeURIComponent(item.id)}`}
                          className="hover:text-tertiary transition-colors"
                        >
                          {item.title}
                        </Link>
                      </td>
                      <td className="p-md">
                        <Chip tone={AI_STATUS_TONE[item.aiStatus]} pulse={item.aiStatus === 'running'}>
                          {humanize(item.aiStatus)}
                        </Chip>
                      </td>
                      <td className="p-md font-body-sm text-body-sm text-on-surface-variant">
                        {item.lastTriageDecision ? humanize(item.lastTriageDecision) : 'Pending'}
                      </td>
                      <td className="p-md font-body-sm text-body-sm text-on-surface-variant">{timeAgo(item.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {connectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-margin" data-testid="boards-connect-modal">
          <div className="w-full max-w-md bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-md shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Connect Board</h3>
              <button
                type="button"
                onClick={() => setConnectOpen(false)}
                className="p-sm rounded hover:bg-surface-variant text-on-surface-variant"
                data-testid="boards-connect-close"
              >
                <X size={18} />
              </button>
            </div>
            {actionError && (
              <p className="font-body-sm text-body-sm text-error" data-testid="boards-action-error" role="alert">
                {actionError}
              </p>
            )}
            <label className="flex flex-col gap-xs">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Project ID</span>
              <input
                className={inputClass}
                value={projectId}
                placeholder="e.g. ACME"
                onChange={(e) => setProjectId(e.target.value)}
                data-testid="boards-connect-project-id"
              />
            </label>
            <label className="flex flex-col gap-xs">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Board name</span>
              <input
                className={inputClass}
                value={boardName}
                placeholder="e.g. Platform Engineering"
                onChange={(e) => setBoardName(e.target.value)}
                data-testid="boards-connect-name"
              />
            </label>
            <div className="flex justify-end gap-sm pt-sm">
              <button
                type="button"
                onClick={() => setConnectOpen(false)}
                className="px-md py-sm rounded border border-outline-variant text-on-surface font-label-md text-label-md hover:bg-surface-variant"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={connect}
                data-testid="boards-connect-submit"
                className="px-md py-sm rounded bg-tertiary text-on-tertiary font-label-md text-label-md font-bold hover:bg-tertiary-fixed disabled:opacity-50"
              >
                {busy ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
