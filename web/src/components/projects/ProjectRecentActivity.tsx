import { Link } from 'react-router-dom';
import type { AuditEvent } from '@shared/types';
import { Card } from '../ui';
import { humanize, timeAgo } from '../../lib/format';
import { projectRoutes } from '../../lib/projectRoutes';

function describeEvent(event: AuditEvent): string {
  if (event.action.startsWith('job.state.')) {
    return `AI job moved to ${humanize(event.action.slice('job.state.'.length))}`;
  }
  const exact: Record<string, string> = {
    'board.synced': 'Synced project',
    'board.connected': 'Connected project',
    'triage.ai_first': 'Sent work to AI',
    'triage.human_first': 'Assigned work to a person',
    'approval.approved': 'Approved a request',
    'approval.rejected': 'Rejected a request',
    'pii.block': 'Blocked sensitive data',
  };
  return exact[event.action] ?? humanize(event.action.replaceAll('.', '_'));
}

export function ProjectRecentActivity({
  projectId,
  events,
}: {
  projectId: string;
  events: AuditEvent[];
}) {
  const recent = events.slice(0, 6);
  return (
    <Card
      title="Recent activity"
      description="Audit events linked to this project's work items or board."
      hierarchy="secondary"
      actions={
        <Link to={projectRoutes.activity(projectId)} className="text-sm font-semibold text-primary hover:underline">
          Full activity
        </Link>
      }
    >
      {recent.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No project-linked audit events yet.</p>
      ) : (
        <ul className="divide-y divide-outline-variant">
          {recent.map((event) => (
            <li key={event.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-on-surface">{describeEvent(event)}</p>
                <p className="mt-1 truncate font-mono text-xs text-on-surface-variant">
                  {event.resource.type} · {event.resource.id}
                </p>
              </div>
              <span className="shrink-0 text-xs text-on-surface-variant">{timeAgo(event.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
