import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApprovalItem } from '@shared/types';
import { Button, CapabilityGate, Card, Field, StatusBadge } from '../ui';
import { humanize, timeAgo } from '../../lib/format';
import { projectRoutes } from '../../lib/projectRoutes';
import type { EnrichedApproval } from '../../lib/workQueue';

export interface ApprovalCardProps {
  item: EnrichedApproval;
  canDecide: boolean;
  busy: boolean;
  onDecide: (item: ApprovalItem, decision: 'approved' | 'rejected', rejectionReason?: string) => Promise<void>;
  showProject?: boolean;
}

export function ApprovalCard({ item, canDecide, busy, onDecide, showProject = true }: ApprovalCardProps) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const workItem = item.workItem;
  const ticketHref = workItem
    ? projectRoutes.workItem(workItem.board.projectId, workItem.id)
    : undefined;

  const submitReject = async () => {
    if (!rejectionReason.trim()) {
      setLocalError('Add a rejection reason before recording this decision.');
      return;
    }
    setLocalError(null);
    await onDecide(item, 'rejected', rejectionReason.trim());
    setRejecting(false);
    setRejectionReason('');
  };

  return (
    <Card
      data-testid={`approval-card-${item.id}`}
      tone={item.risk === 'high' ? 'blush' : item.risk === 'medium' ? 'butter' : 'default'}
      className="flex flex-col gap-md"
    >
      <div className="flex items-start justify-between gap-md">
        <div className="min-w-0">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">{item.title}</h3>
          <p className="mt-xs font-body-sm text-body-sm text-on-surface-variant">{item.reason}</p>
          <p className="mt-sm font-label-sm text-label-sm text-on-surface-variant">
            Requested {timeAgo(item.requestedAt)}
          </p>
        </div>
        <StatusBadge
          status={item.risk}
          label={`${humanize(item.risk)} risk`}
          tone={item.risk === 'high' ? 'danger' : item.risk === 'medium' ? 'warning' : 'neutral'}
        />
      </div>

      <dl className="grid gap-3 rounded-lg bg-surface/60 p-3 text-sm sm:grid-cols-3">
        {showProject && (
          <div>
            <dt className="text-on-surface-variant">Project</dt>
            <dd className="mt-1 font-mono text-on-surface">
              {workItem ? (
                <Link to={projectRoutes.project(workItem.board.projectId)} className="hover:text-primary">
                  {workItem.board.projectId}
                </Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-on-surface-variant">Issue</dt>
          <dd className="mt-1 font-mono text-on-surface">
            {workItem ? workItem.board.issueKey : item.workItemId}
          </dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">Ticket</dt>
          <dd className="mt-1 text-on-surface">{workItem?.title ?? 'Work item unavailable'}</dd>
        </div>
      </dl>

      {(localError || rejecting) && (
        <div className="rounded-lg border border-outline-variant p-3">
          {localError && <p className="mb-2 text-sm text-error">{localError}</p>}
          {rejecting && (
            <Field
              label="Rejection reason"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Why should this request not proceed?"
              hint="Required to confirm. The current API records the rejection, but does not persist this note."
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-sm">
        {ticketHref ? (
          <Link
            to={ticketHref}
            className="rounded border border-outline-variant px-md py-sm font-label-md text-label-md text-on-surface hover:bg-surface-variant"
            data-testid={`approval-open-${item.id}`}
          >
            Open ticket
          </Link>
        ) : (
          <span className="rounded border border-outline-variant px-md py-sm font-label-md text-label-md text-on-surface-variant">
            Ticket unavailable
          </span>
        )}
        <CapabilityGate allowed={canDecide}>
          <Button loading={busy} onClick={() => void onDecide(item, 'approved')} data-testid={`approval-approve-${item.id}`}>
            Record approval
          </Button>
          {rejecting ? (
            <>
              <Button
                variant="danger"
                loading={busy}
                disabled={!rejectionReason.trim()}
                onClick={() => void submitReject()}
                data-testid={`approval-reject-${item.id}`}
              >
                Record rejection
              </Button>
              <Button
                variant="quiet"
                onClick={() => {
                  setRejecting(false);
                  setRejectionReason('');
                  setLocalError(null);
                }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setRejecting(true)} data-testid={`approval-reject-${item.id}`}>
              Reject…
            </Button>
          )}
        </CapabilityGate>
      </div>
    </Card>
  );
}
