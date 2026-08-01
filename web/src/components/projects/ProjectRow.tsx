import { Link } from 'react-router-dom';
import type { BoardHealth } from '@shared/types';
import { RefreshCw } from 'lucide-react';
import { Button, CapabilityGate, Card, StatusBadge, Tag } from '../ui';
import { formatNumber, timeAgo } from '../../lib/format';
import { projectRoutes } from '../../lib/projectRoutes';
import type { ProjectAttentionCounts } from '../../lib/workQueue';

const BOARD_STATE: Record<BoardHealth['state'], { tone: 'success' | 'info' | 'danger' | 'neutral'; label: string }> = {
  healthy: { tone: 'success', label: 'Healthy' },
  syncing: { tone: 'info', label: 'Syncing' },
  error: { tone: 'danger', label: 'Sync error' },
  queued: { tone: 'neutral', label: 'Queued' },
};

export interface ProjectRowProps {
  board: BoardHealth;
  counts: ProjectAttentionCounts;
  canManage: boolean;
  syncing: boolean;
  onSync: () => void;
}

export function ProjectRow({ board, counts, canManage, syncing, onSync }: ProjectRowProps) {
  const state = BOARD_STATE[board.state];
  return (
    <Card
      data-testid={`board-card-${board.projectId}`}
      hierarchy="primary"
      className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={projectRoutes.project(board.projectId)}
            className="truncate text-base font-semibold text-on-surface hover:text-primary"
          >
            {board.name}
          </Link>
          <StatusBadge
            status={board.state}
            tone={state.tone}
            label={`${board.state === 'error' ? '⚠ ' : ''}${state.label}`}
          />
        </div>
        <p className="mt-1 font-mono text-xs text-on-surface-variant">
          {board.issuePrefix} · {board.projectId}
        </p>
        <p className="mt-2 text-sm text-on-surface-variant">
          {board.state === 'error'
            ? `Last sync failed ${timeAgo(board.lastSyncAt)}`
            : board.state === 'syncing'
              ? 'Sync in progress'
              : `Last sync ${timeAgo(board.lastSyncAt)}`}
          {' · '}
          {formatNumber(board.activeIssues)} active issues
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Tag tone="butter">Triage {counts.triage}</Tag>
          <Tag tone="mint">Review {counts.review}</Tag>
          <Tag tone="blush">Blocked {counts.blocked}</Tag>
          <Tag tone="primary">Approvals {counts.approvals}</Tag>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Link
          to={projectRoutes.project(board.projectId)}
          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-outline-variant bg-surface px-3 text-xs font-semibold text-on-surface hover:bg-surface-container"
        >
          Open workspace
        </Link>
        <CapabilityGate allowed={canManage}>
          <Button
            variant="secondary"
            loading={syncing}
            onClick={onSync}
            data-testid={`board-sync-${board.projectId}`}
            className="min-h-9 px-3 text-xs"
          >
            <RefreshCw size={14} /> Sync
          </Button>
        </CapabilityGate>
      </div>
    </Card>
  );
}
