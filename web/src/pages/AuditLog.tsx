import { useMemo, useState } from 'react';
import { Clock, Download, Search, ScrollText } from 'lucide-react';
import { api } from '@shared/api';
import type { AuditEvent } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import Chip from '../components/Chip';
import { formatTimestamp, humanize } from '../lib/format';

function matchesQuery(event: AuditEvent, q: string): boolean {
  if (!q) return true;
  const hay = [
    event.id,
    event.action,
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

export default function AuditLog() {
  const { data: events, loading, error, reload } = useAsync(() => api.listAuditEvents(), []);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (events ?? []).filter((e) => matchesQuery(e, q));
  }, [events, query]);

  return (
    <div className="max-w-container-max mx-auto p-margin flex flex-col gap-xl" data-testid="audit-log-page">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-semibold text-on-surface">System Audit Log</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-sm max-w-2xl">
            Immutable record of all system, AI, and user actions for compliance and debugging.
          </p>
        </div>
        <button
          type="button"
          disabled={!filtered.length}
          onClick={() => exportCsv(filtered)}
          data-testid="audit-export-csv"
          className="px-md py-sm rounded border border-outline-variant bg-transparent text-on-surface hover:bg-surface-variant transition-colors font-label-md text-label-md flex items-center gap-sm disabled:opacity-50"
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>

      <div className="bg-surface-container rounded-lg border border-outline-variant p-sm flex items-center gap-md">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ID, actor, action, or resource…"
            className="w-full h-9 bg-surface-variant border border-transparent rounded focus:border-outline-variant focus:ring-0 text-body-sm text-on-surface pl-10 pr-3 placeholder-on-surface-variant outline-none"
          />
        </div>
      </div>

      {loading && <LoadingState label="Loading audit events…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && events && events.length === 0 && (
        <EmptyState
          icon={<ScrollText size={22} />}
          title="No audit events yet"
          body="Actions such as triage, policy updates, and board sync will appear here."
        />
      )}
      {!loading && !error && events && events.length > 0 && filtered.length === 0 && (
        <EmptyState title="No matching events" body="Try a different search term." />
      )}

          {!loading && !error && filtered.length > 0 && (
        <div
          className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden overflow-x-auto"
          data-testid="audit-table"
        >
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-surface-variant/50 border-b border-outline-variant">
                <th className="p-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Timestamp</th>
                <th className="p-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Log ID</th>
                <th className="p-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Actor</th>
                <th className="p-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Action</th>
                <th className="p-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Resource</th>
                <th className="p-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Security Layers</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-outline-variant/30 hover:bg-surface-variant/30 transition-colors"
                  data-testid={`audit-row-${event.id}`}
                >
                  <td className="p-md font-body-sm text-body-sm text-on-surface whitespace-nowrap">
                    <span className="inline-flex items-center gap-xs">
                      <Clock size={14} className="text-on-surface-variant" />
                      {formatTimestamp(event.createdAt)}
                    </span>
                  </td>
                  <td className="p-md font-mono text-body-sm text-on-surface-variant">{event.id}</td>
                  <td className="p-md font-body-sm text-body-sm text-on-surface">
                    <span className="block">{humanize(event.actor.type)}</span>
                    <span className="font-mono text-label-sm text-on-surface-variant">{event.actor.id}</span>
                  </td>
                  <td
                    className="p-md font-body-sm text-body-sm text-on-surface font-mono"
                    data-testid={`audit-action-${event.id}`}
                  >
                    {event.action}
                  </td>
                  <td className="p-md font-body-sm text-body-sm text-on-surface">
                    <span className="block">{humanize(event.resource.type)}</span>
                    <span className="font-mono text-label-sm text-on-surface-variant">{event.resource.id}</span>
                  </td>
                  <td className="p-md">
                    <div className="flex flex-wrap gap-xs">
                      {event.securityLayersApplied.length === 0 ? (
                        <span className="font-label-sm text-label-sm text-on-surface-variant">—</span>
                      ) : (
                        event.securityLayersApplied.map((layer) => (
                          <Chip key={`${event.id}-L${layer}`} tone="tertiary">
                            L{layer}
                          </Chip>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
