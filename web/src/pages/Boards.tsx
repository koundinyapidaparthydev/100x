import { AlertTriangle, Compass, Filter, Plus, RefreshCw } from 'lucide-react';
import { api } from '@shared/api';
import type { BoardHealth } from '@shared/types';
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

export default function Boards() {
  const { data: boards, loading, error, reload } = useAsync(() => api.listBoards(), []);

  return (
    <div className="max-w-container-max mx-auto p-margin flex flex-col gap-xl">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-semibold text-on-surface">Jira Sync Health</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-sm max-w-2xl">
            Monitor real-time synchronization status and AI delegation readiness across connected project boards.
          </p>
        </div>
        <div className="flex gap-md">
          <button className="px-md py-sm rounded border border-outline-variant text-on-surface font-label-md text-label-md flex items-center gap-xs hover:bg-surface-variant transition-colors">
            <RefreshCw size={18} />
            Sync All
          </button>
          <button className="px-md py-sm rounded bg-tertiary text-on-tertiary font-label-md text-label-md flex items-center gap-xs hover:bg-tertiary-fixed transition-colors font-bold">
            <Plus size={18} />
            Connect Board
          </button>
        </div>
      </div>

      {/* Filter bar (visual only) */}
      <div className="bg-surface-container rounded-lg border border-outline-variant p-sm flex items-center gap-md overflow-x-auto">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Filter by Project Key..."
            className="w-full h-9 bg-surface-variant border border-transparent rounded focus:border-outline-variant focus:ring-0 text-body-sm text-on-surface pl-10 pr-3 placeholder-on-surface-variant outline-none"
          />
        </div>
        <div className="h-6 w-px bg-outline-variant"></div>
        <div className="flex items-center gap-sm shrink-0">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Health</span>
          <select className="h-9 bg-surface-variant border border-transparent rounded focus:border-outline-variant focus:ring-0 text-body-sm text-on-surface pl-3 pr-8 appearance-none outline-none">
            <option value="all">All States</option>
            <option value="healthy">Healthy</option>
            <option value="syncing">Syncing</option>
            <option value="error">Error</option>
          </select>
        </div>
        <div className="flex items-center gap-sm shrink-0">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Delegation</span>
          <select className="h-9 bg-surface-variant border border-transparent rounded focus:border-outline-variant focus:ring-0 text-body-sm text-on-surface pl-3 pr-8 appearance-none outline-none">
            <option value="all">Any Readiness</option>
            <option value="ready">Fully Ready</option>
            <option value="partial">Partial</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </div>

      {loading && <LoadingState label="Loading boards…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && boards && boards.length === 0 && (
        <EmptyState
          icon={<Compass size={22} />}
          title="No boards connected"
          body="Connect a Jira project to start syncing work items into OffshoreHelper."
        />
      )}

      {!loading && !error && boards && boards.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-lg">
          {boards.map((board) => {
            const state = BOARD_STATE[board.state];
            const readiness = READINESS[board.aiReadiness];
            return (
              <div
                key={board.projectId}
                className={`bg-surface-container border rounded-xl p-lg flex flex-col gap-md relative overflow-hidden group transition-colors ${
                  board.state === 'error'
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
                      <p className="font-label-sm text-label-sm text-on-surface-variant font-mono">{board.issuePrefix}</p>
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
                        board.state === 'error' ? 'text-error' : board.state === 'syncing' ? 'text-on-surface animate-pulse' : 'text-on-surface'
                      }`}
                    >
                      {board.state === 'error' ? `Failed ${timeAgo(board.lastSyncAt)}` : board.state === 'syncing' ? 'In progress' : timeAgo(board.lastSyncAt)}
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
