import { useState } from 'react';
import { Check, CheckSquare, Clock, X } from 'lucide-react';
import { api } from '@shared/api';
import type { ApprovalItem } from '@shared/types';
import { cn } from '../lib/utils';
import { useAsync } from '../lib/useAsync';
import { timeAgo } from '../lib/format';
import { riskChip } from '../lib/chips';
import { LoadingState, ErrorState, EmptyState } from '../components/States';

export function Approvals() {
  const { data, error, loading, retry } = useAsync(() => api.listApprovals());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const decide = async (item: ApprovalItem, decision: 'approved' | 'rejected') => {
    setDecisionError(null);
    setBusyId(item.id);
    try {
      await api.decideApproval(item.id, decision);
      retry(); // refresh the list
    } catch (e) {
      setDecisionError(e instanceof Error ? e.message : 'Decision failed. Try again.');
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingState label="Loading approvals…" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <ErrorState error={error} onRetry={retry} />
      </div>
    );
  }

  const pending = data.filter((a) => a.status === 'pending');
  const decided = data.filter((a) => a.status !== 'pending');

  return (
    <div className="flex flex-col px-4 py-4 gap-4 max-w-md mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="font-headline-lg text-on-surface mb-1">Approvals</h1>
        <p className="font-body-sm text-on-surface-variant">
          High-risk AI actions and mutating tool calls waiting on a manager decision.
        </p>
      </div>

      {decisionError && (
        <div className="px-3 py-2 rounded-lg bg-error-container text-on-error-container font-body-sm text-center">
          {decisionError}
        </div>
      )}

      {data.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="Nothing to approve"
          body="High-risk AI actions that need a manager sign-off will appear here."
        />
      ) : (
        <>
          {pending.map((item) => (
            <ApprovalCard
              key={item.id}
              item={item}
              busy={busyId === item.id}
              onDecide={(decision) => void decide(item, decision)}
            />
          ))}
          {decided.length > 0 && (
            <>
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant font-semibold border-b border-outline-variant pb-1 mt-2">
                Decided
              </h2>
              {decided.map((item) => (
                <ApprovalCard key={item.id} item={item} busy={false} onDecide={() => {}} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

function ApprovalCard({
  item,
  busy,
  onDecide,
}: {
  item: ApprovalItem;
  busy: boolean;
  onDecide: (decision: 'approved' | 'rejected') => void;
}) {
  const risk = riskChip(item.risk);
  const isPending = item.status === 'pending';

  return (
    <article
      className={cn(
        'bg-surface-container-lowest rounded-xl border border-outline-variant flex flex-col',
        !isPending && 'opacity-50',
      )}
    >
      <div className="p-4 pb-2 border-b border-surface-container flex justify-between items-start gap-2">
        <div className="min-w-0">
          <span className="font-mono text-[10px] font-medium text-on-surface-variant uppercase tracking-widest block mb-1">
            Ticket {item.workItemId}
          </span>
          <h2 className="font-headline-sm text-on-surface">{item.title}</h2>
        </div>
        <span className={cn('px-2 py-1 rounded font-mono text-[10px] uppercase tracking-widest shrink-0', risk.className)}>
          {risk.label}
        </span>
      </div>
      <div className="p-4 flex-1">
        <p className="font-body-sm text-on-surface-variant mb-3">{item.reason}</p>
        <div className="flex items-center gap-1.5 text-on-surface-variant">
          <Clock className="w-4 h-4" />
          <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
            Requested {timeAgo(item.requestedAt)}
          </span>
        </div>
      </div>
      {isPending ? (
        <div className="p-2 bg-surface-container-low flex gap-2 border-t border-outline-variant rounded-b-xl">
          <button
            onClick={() => onDecide('approved')}
            disabled={busy}
            className="flex-1 h-11 flex items-center justify-center gap-1.5 font-sans text-sm font-semibold text-on-primary bg-primary rounded-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Check className="w-4 h-4" /> {busy ? 'Sending…' : 'Approve'}
          </button>
          <button
            onClick={() => onDecide('rejected')}
            disabled={busy}
            className="flex-1 h-11 flex items-center justify-center gap-1.5 font-sans text-sm font-semibold text-on-error bg-error rounded-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <X className="w-4 h-4" /> Reject
          </button>
        </div>
      ) : (
        <div className="p-2 bg-surface-container-low border-t border-outline-variant rounded-b-xl">
          <span
            className={cn(
              'block text-center font-mono text-[10px] uppercase tracking-widest py-2',
              item.status === 'approved' ? 'text-primary' : 'text-error',
            )}
          >
            {item.status}
          </span>
        </div>
      )}
    </article>
  );
}
