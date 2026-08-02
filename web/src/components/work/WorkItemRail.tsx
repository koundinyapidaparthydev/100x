import { AlertTriangle } from 'lucide-react';
import type { AiJob, AuditEvent } from '@shared/types';
import { Card, StatusBadge } from '../ui';
import { cloudModeDisplay, formatTokens, humanize, providerDisplay, timeAgo } from '../../lib/format';

export function WorkItemLifecycleRail({
  job,
  auditTransitions,
}: {
  job: AiJob | null;
  auditTransitions: AuditEvent[];
}) {
  return (
    <Card title="Recorded lifecycle" description="Only state transitions found in the audit log are shown." hierarchy="secondary">
      {!job && <p className="text-sm text-on-surface-variant">No AI job has run for this item.</p>}
      {job?.error && (
        <div className="mb-3 flex gap-2 rounded-lg bg-warning-container p-3 text-sm text-on-warning-container">
          <AlertTriangle size={16} className="shrink-0" />
          {job.error}
        </div>
      )}
      {job && auditTransitions.length === 0 && (
        <p className="text-sm text-on-surface-variant">No audit transitions were returned for this job.</p>
      )}
      {auditTransitions.length > 0 && (
        <ol className="space-y-3">
          {auditTransitions.map((event) => {
            const state = event.action.replace('job.state.', '');
            return (
              <li key={event.id} className="flex items-center justify-between gap-3 border-b border-outline-variant pb-3 last:border-0">
                <StatusBadge status={state} />
                <span className="text-xs text-on-surface-variant">{timeAgo(event.createdAt)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

export function WorkItemJobRail({
  job,
  securityLayers,
}: {
  job: AiJob;
  securityLayers: number[];
}) {
  return (
    <>
      <Card title="Token usage" hierarchy="secondary">
        <div className="flex flex-col gap-2">
          {(
            [
              ['Input', job.tokenUsage.input],
              ['Output', job.tokenUsage.output],
              ['Total', job.tokenUsage.total],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-on-surface-variant">{label}</span>
              <span className="font-mono text-on-surface">{formatTokens(value)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="PII report" hierarchy="secondary">
        <div className="flex items-center justify-between text-sm">
          <span className="text-on-surface-variant">Redactions applied</span>
          <span className="font-mono text-tertiary">{job.piiReport.redactions}</span>
        </div>
        <div className="mt-3 flex flex-col gap-1">
          <span className="text-sm text-on-surface-variant">Blocked categories</span>
          {job.piiReport.blocks.length === 0 ? (
            <span className="text-sm text-on-surface">None — payload cleared the firewall.</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {job.piiReport.blocks.map((block) => (
                <StatusBadge key={block} status={block} tone="warning" label={humanize(block)} />
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card title="Execution details" hierarchy="secondary">
        {securityLayers.length > 0 && (
          <div className="mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Security layers (audit)
            </span>
            <div className="mt-2 flex flex-wrap gap-1">
              {securityLayers.map((layer) => (
                <StatusBadge key={`L${layer}`} status={`layer-${layer}`} tone="info" label={`Layer ${layer}`} />
              ))}
            </div>
          </div>
        )}
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Where this ran</span>
          <p className="mt-1 font-mono text-sm text-on-surface">{job.model.modelId}</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            {providerDisplay(job.cloudExecution.provider, job.cloudExecution.customLabel)} ·{' '}
            {job.cloudExecution.region} · {cloudModeDisplay(job.cloudExecution.mode)}
          </p>
        </div>
      </Card>
    </>
  );
}
