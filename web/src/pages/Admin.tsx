import { CheckSquare, ExternalLink, FolderKanban, Key, ScrollText, Shield, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api';
import { useAsync } from '../lib/useAsync';
import { AsyncBoundary, Card, PageContainer, PageHeader, StatusBadge } from '../components/ui';
import { humanize } from '../lib/format';

export default function Admin() {
  const { data, loading, error, reload } = useAsync(() => api.me(), []);
  const destinations = [
    { title: 'Projects', detail: 'Connected projects and operational work', to: '/projects', icon: FolderKanban },
    { title: 'Governance', detail: 'Policy, PII, model, and cloud defaults', to: '/governance/defaults', icon: ShieldCheck },
    { title: 'Approvals', detail: 'Organization exception decisions', to: '/approvals', icon: CheckSquare },
    { title: 'Audit', detail: 'Organization-wide recorded events', to: '/audit', icon: ScrollText },
  ];

  return (
    <PageContainer width="form" className="flex flex-col gap-6" data-testid="admin-page">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Organization identity, access role, and shortcuts to governance and audit."
        actions={<StatusBadge status="warning" tone="warning" label="Sandbox only" />}
      />

      <AsyncBoundary loading={loading} error={error} loadingLabel="Loading organization information…" onRetry={reload}>
        {data && (
          <Card
            title="Organization information"
            description="Read-only values from the authenticated session."
          >
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-on-surface-variant">Organization ID</dt>
                <dd className="mt-1 break-all font-mono font-semibold text-on-surface">{data.user.tenantId}</dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">Signed in as</dt>
                <dd className="mt-1 font-medium text-on-surface">{data.user.displayName}</dd>
                <dd className="break-all text-xs text-on-surface-variant">{data.user.email}</dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">Access role</dt>
                <dd className="mt-1"><StatusBadge status={data.user.role} label={humanize(data.user.role)} /></dd>
              </div>
            </dl>
          </Card>
        )}
      </AsyncBoundary>

      <Card title="Operational workspaces" description="Summaries and actions live with the resources they describe.">
        <div className="grid gap-2 sm:grid-cols-2">
          {destinations.map(({ title, detail, to, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex min-w-0 items-center gap-3 rounded-lg border border-outline-variant p-3 transition-colors hover:bg-surface-container-low"
            >
              <Icon size={18} className="shrink-0 text-on-surface-variant" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-on-surface">{title}</span>
                <span className="block text-xs text-on-surface-variant">{detail}</span>
              </span>
              <ExternalLink size={15} className="shrink-0 text-on-surface-variant group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </Card>

      <Card
        hierarchy="secondary"
        title="Additional administration"
        description="These capabilities do not have working controls or API support in this version."
        actions={<StatusBadge status="unavailable" label="Unavailable" />}
      >
        <ul className="grid gap-3 text-sm text-on-surface-variant sm:grid-cols-3">
          {[
            { label: 'User lifecycle and SSO', icon: Users },
            { label: 'Custom roles and permissions', icon: Shield },
            { label: 'Integration secret management', icon: Key },
          ].map(({ label, icon: Icon }) => (
            <li key={label} className="flex items-center gap-2">
              <Icon size={16} className="shrink-0" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </Card>
    </PageContainer>
  );
}
