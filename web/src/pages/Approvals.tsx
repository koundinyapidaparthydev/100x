import { useState } from 'react';
import { Check, CheckSquare, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api';
import type { ApprovalItem } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import Chip, { type ChipTone } from '../components/Chip';
import { humanize, timeAgo } from '../lib/format';

const RISK_TONE: Record<ApprovalItem['risk'], ChipTone> = {
  low: 'surface',
  medium: 'warning',
  high: 'error',
};

export default function Approvals() {
  const { data, loading, error, reload } = useAsync(() => api.listApprovals(), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const pending = (data ?? []).filter((a) => a.status === 'pending');
  const decided = (data ?? []).filter((a) => a.status !== 'pending');

  return (
    <div className="max-w-container-max mx-auto p-margin flex flex-col gap-xl" data-testid="approvals-page">
      <div>
        <h2 className="font-headline-lg text-headline-lg font-semibold text-on-surface">Approvals</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-sm max-w-2xl">
          High-risk AI actions and mutating tool calls waiting on a manager decision.
        </p>
      </div>

      {actionError && (
        <p className="font-body-sm text-body-sm text-error" data-testid="approvals-error">
          {actionError}
        </p>
      )}

      {loading && <LoadingState label="Loading approvals…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && data && data.length === 0 && (
        <EmptyState
          icon={<CheckSquare size={22} />}
          title="Nothing to approve"
          body="High-risk AI actions that need a manager sign-off will appear here."
        />
      )}

      {!loading && !error && pending.length > 0 && (
        <div className="flex flex-col gap-md" data-testid="approvals-pending-list">
          {pending.map((item) => (
            <article
              key={item.id}
              data-testid={`approval-card-${item.id}`}
              className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-md"
            >
              <div className="flex items-start justify-between gap-md">
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">{item.title}</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs">{item.reason}</p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant mt-sm">
                    Requested {timeAgo(item.requestedAt)}
                  </p>
                </div>
                <Chip tone={RISK_TONE[item.risk]}>{humanize(item.risk)} risk</Chip>
              </div>
              <div className="flex flex-wrap gap-sm">
                <Link
                  to={`/boards/task/${encodeURIComponent(item.workItemId)}`}
                  className="px-md py-sm rounded border border-outline-variant text-on-surface font-label-md text-label-md hover:bg-surface-variant"
                  data-testid={`approval-open-${item.id}`}
                >
                  Open ticket
                </Link>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void decide(item, 'approved')}
                  className="px-md py-sm rounded bg-tertiary text-on-tertiary font-label-md text-label-md font-bold hover:bg-tertiary-fixed disabled:opacity-50 flex items-center gap-xs"
                  data-testid={`approval-approve-${item.id}`}
                >
                  <Check size={16} />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void decide(item, 'rejected')}
                  className="px-md py-sm rounded border border-error/40 text-error font-label-md text-label-md hover:bg-error/10 disabled:opacity-50 flex items-center gap-xs"
                  data-testid={`approval-reject-${item.id}`}
                >
                  <X size={16} />
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && !error && decided.length > 0 && (
        <div className="flex flex-col gap-md" data-testid="approvals-decided-list">
          <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Decided</h3>
          {decided.map((item) => (
            <div
              key={item.id}
              className="bg-surface-container border border-outline-variant rounded-xl p-md flex items-center justify-between gap-md"
            >
              <span className="font-body-sm text-body-sm text-on-surface">{item.title}</span>
              <Chip tone={item.status === 'approved' ? 'tertiary' : 'error'}>{humanize(item.status)}</Chip>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
