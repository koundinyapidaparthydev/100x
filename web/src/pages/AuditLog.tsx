import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { api } from '@shared/api';
import type { AuditEvent } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import { AsyncBoundary, Button, Field, PageContainer, PageHeader, ResponsiveDataList, StatusBadge } from '../components/ui';
import { formatTimestamp, humanize } from '../lib/format';

function describeEvent(event: AuditEvent): string {
  const exact: Record<string, string> = {
    'auth.login': 'Signed in',
    'work_item.assignee_updated': 'Updated the assignee',
    'pii.access_requested': 'Requested review of blocked sensitive data',
    'triage.human_first': 'Assigned work to a person',
    'triage.ai_first': 'Sent work to AI',
    'board.connected': 'Connected a project',
    'board.synced': 'Synced a connected project',
    'policy.updated': 'Updated the organization policy',
    'approval.approved': 'Approved a request',
    'approval.rejected': 'Rejected a request',
    'pii.block': 'Blocked a model call after detecting sensitive data',
    'board.writeback.completed': 'Wrote reviewed output back to the project',
  };
  if (exact[event.action]) return exact[event.action];
  if (event.action.startsWith('job.state.')) {
    return `AI job moved to ${humanize(event.action.slice('job.state.'.length))}`;
  }
  return humanize(event.action.replaceAll('.', '_'));
}

function actorLabel(event: AuditEvent): string {
  if (event.actor.type === 'system') return event.actor.id === 'orchestrator' ? 'Automation' : 'System';
  return event.actor.id;
}

function matchesQuery(event: AuditEvent, q: string, actorType: string, resourceType: string): boolean {
  if (actorType && event.actor.type !== actorType) return false;
  if (resourceType && event.resource.type !== resourceType) return false;
  if (!q) return true;
  const hay = [
    event.id,
    event.action,
    describeEvent(event),
    event.actor.type,
    event.actor.id,
    event.resource.type,
    event.resource.id,
    ...event.securityLayersApplied.map(String),
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

function exportCsv(events: AuditEvent[]) {
  const header = [
    'id',
    'createdAt',
    'actorType',
    'actorId',
    'action',
    'resourceType',
    'resourceId',
    'securityLayersApplied',
  ];
  const rows = events.map((e) =>
    [
      e.id,
      e.createdAt,
      e.actor.type,
      e.actor.id,
      e.action,
      e.resource.type,
      e.resource.id,
      e.securityLayersApplied.join('|'),
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(','),
  );
  const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aplifyai-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function metadataString(event: AuditEvent, key: string): string | null {
  const value = event.metadata[key];
  return typeof value === 'string' ? value : null;
}

async function loadEvents(projectId?: string): Promise<{ events: AuditEvent[]; projectName: string | null }> {
  if (!projectId) {
    return { events: await api.listAuditEvents(), projectName: null };
  }

  const [events, workItems, jobs, approvals, boards] = await Promise.all([
    api.listAuditEvents(),
    api.listWorkItems({ projectId }),
    api.listJobs(),
    api.listApprovals().catch(() => []),
    api.listBoards(),
  ]);
  const workItemIds = new Set(workItems.map((item) => item.id));
  const issueIds = new Set(workItems.flatMap((item) => [item.board.issueId, item.board.issueKey]));
  const projectJobs = jobs.filter((job) => workItemIds.has(job.workItemId));
  const jobIds = new Set(projectJobs.map((job) => job.id));
  const approvalIds = new Set(
    approvals.filter((approval) => workItemIds.has(approval.workItemId)).map((approval) => approval.id),
  );

  const projectEvents = events.filter((event) => {
    const resourceId = event.resource.id;
    const metadataWorkItemId = metadataString(event, 'workItemId');
    const metadataJobId = metadataString(event, 'aiJobId') ?? metadataString(event, 'jobId');
    const metadataIssueKey = metadataString(event, 'issueKey');
    return (
      (event.resource.type === 'board' && resourceId === projectId) ||
      workItemIds.has(resourceId) ||
      issueIds.has(resourceId) ||
      jobIds.has(resourceId) ||
      approvalIds.has(resourceId) ||
      (metadataWorkItemId !== null && workItemIds.has(metadataWorkItemId)) ||
      (metadataJobId !== null && jobIds.has(metadataJobId)) ||
      metadataString(event, 'projectId') === projectId ||
      (metadataIssueKey !== null && issueIds.has(metadataIssueKey))
    );
  });

  return {
    events: projectEvents,
    projectName: boards.find((board) => board.projectId === projectId)?.name ?? projectId,
  };
}

export default function AuditLog() {
  const { projectId } = useParams<{ projectId?: string }>();
  const { data, loading, error, reload } = useAsync(() => loadEvents(projectId), [projectId]);
  const events = data?.events;
  const [query, setQuery] = useState('');
  const [actorType, setActorType] = useState('');
  const [resourceType, setResourceType] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (events ?? []).filter((event) => matchesQuery(event, q, actorType, resourceType));
  }, [actorType, events, query, resourceType]);

  const actorTypes = useMemo(() => [...new Set((events ?? []).map((event) => event.actor.type))].sort(), [events]);
  const resourceTypes = useMemo(() => [...new Set((events ?? []).map((event) => event.resource.type))].sort(), [events]);

  return (
    <PageContainer
      className="flex flex-col gap-6"
      data-testid="audit-log-page"
      data-project-id={projectId}
    >
      <PageHeader
        eyebrow={projectId ? `Project / ${projectId}` : 'Organization / Evidence'}
        title={projectId ? 'Activity' : 'Audit events'}
        description={
          projectId
            ? `Events related to ${data?.projectName ?? projectId}, joined from its work items, AI jobs, approvals, and board activity.`
            : 'Events recorded across the organization for operational review and debugging. Retention and tamper protection are not asserted by this interface.'
        }
        actions={
          <Button
            variant="secondary"
            disabled={!filtered.length}
            onClick={() => exportCsv(filtered)}
            data-testid="audit-export-csv"
          >
            <Download size={16} /> Export CSV
          </Button>
        }
      />

      <div className="grid gap-3 rounded-xl border border-outline-variant bg-surface p-4 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <Field
          label="Search events"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Action, person, resource, or event ID"
        />
        <label className="block text-sm font-medium text-on-surface">
          Actor type
          <select
            className="mt-1.5 min-h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
            value={actorType}
            onChange={(event) => setActorType(event.target.value)}
          >
            <option value="">All actors</option>
            {actorTypes.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-on-surface">
          Resource type
          <select
            className="mt-1.5 min-h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary"
            value={resourceType}
            onChange={(event) => setResourceType(event.target.value)}
          >
            <option value="">All resources</option>
            {resourceTypes.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
          </select>
        </label>
      </div>

      <AsyncBoundary
        loading={loading}
        error={error}
        empty={!loading && !error && filtered.length === 0}
        loadingLabel="Loading audit events…"
        emptyTitle={events?.length ? 'No matching events' : 'No audit events yet'}
        emptyBody={
          events?.length
            ? 'Clear a filter or try a different search.'
            : projectId
              ? 'No recorded events could be joined to this project.'
              : 'Recorded application actions will appear here.'
        }
        onRetry={reload}
      >
        <div data-testid="audit-table">
          <ResponsiveDataList
            items={filtered}
            getKey={(event) => event.id}
            caption="Recorded application events"
            columns={[
              {
                key: 'event',
                label: 'Event',
                render: (event) => (
                  <div data-testid={`audit-action-${event.id}`}>
                    <p className="font-medium">{describeEvent(event)}</p>
                    <p className="mt-1 font-mono text-xs text-on-surface-variant">{event.action}</p>
                  </div>
                ),
              },
              {
                key: 'actor',
                label: 'Actor',
                render: (event) => (
                  <div>
                    <p>{actorLabel(event)}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{humanize(event.actor.type)}</p>
                  </div>
                ),
              },
              {
                key: 'resource',
                label: 'Resource',
                render: (event) => (
                  <div>
                    <p>{humanize(event.resource.type)}</p>
                    <p className="mt-1 break-all font-mono text-xs text-on-surface-variant">{event.resource.id}</p>
                  </div>
                ),
              },
              {
                key: 'checks',
                label: 'Recorded checks',
                render: (event) =>
                  event.securityLayersApplied.length ? (
                    <StatusBadge status="info" tone="info" label={`Layers ${event.securityLayersApplied.join(', ')}`} />
                  ) : (
                    <span className="text-on-surface-variant">None listed</span>
                  ),
              },
              {
                key: 'time',
                label: 'Recorded',
                className: 'whitespace-nowrap',
                render: (event) => (
                  <div>
                    <p>{formatTimestamp(event.createdAt)}</p>
                    <p className="mt-1 font-mono text-xs text-on-surface-variant">{event.id}</p>
                  </div>
                ),
              },
            ]}
            renderMobile={(event) => (
              <article data-testid={`audit-row-${event.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium text-on-surface">{describeEvent(event)}</h2>
                    <p className="mt-1 text-xs text-on-surface-variant">{actorLabel(event)} · {formatTimestamp(event.createdAt)}</p>
                  </div>
                  <StatusBadge status={event.actor.type} label={humanize(event.actor.type)} />
                </div>
                <p className="mt-3 text-sm text-on-surface-variant">{humanize(event.resource.type)} · {event.resource.id}</p>
                <p className="mt-2 font-mono text-xs text-on-surface-variant">{event.action} · {event.id}</p>
              </article>
            )}
          />
        </div>
      </AsyncBoundary>
    </PageContainer>
  );
}
