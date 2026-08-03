import { FormEvent, useEffect, useState } from 'react';
import { CheckSquare, CloudUpload, ExternalLink, FolderKanban, LayoutGrid, ScrollText, Shield, ShieldCheck, Users, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api';
import type { InvitableRole, WorkspaceInvite } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import { AsyncBoundary, Button, Card, Field, PageContainer, PageHeader, StatusBadge } from '../components/ui';
import { humanize, roleDisplay } from '../lib/format';

const INVITE_ROLES: { id: InvitableRole; label: string }[] = [
  { id: 'manager', label: 'Delivery lead' },
  { id: 'engineer', label: 'Contributor' },
  { id: 'auditor', label: 'Auditor' },
];

export default function Admin() {
  const { data, loading, error, reload } = useAsync(() => api.me(), []);
  const isRoot = data?.user.role === 'root';
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InvitableRole>('manager');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [lastPreview, setLastPreview] = useState<string | null>(null);

  const loadInvites = async () => {
    if (!isRoot) return;
    setInvitesLoading(true);
    try {
      const res = await api.listInvites();
      setInvites(res.invites);
    } catch {
      setInvites([]);
    } finally {
      setInvitesLoading(false);
    }
  };

  useEffect(() => {
    void loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when role known
  }, [isRoot]);

  const onInvite = async (e: FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteBusy(true);
    try {
      const res = await api.createInvite({ email: inviteEmail, role: inviteRole });
      setLastPreview(res.emailDelivery.preview);
      setInviteEmail('');
      await loadInvites();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setInviteBusy(false);
    }
  };

  const destinations = [
    { title: 'Console', detail: 'Search-first home for identity and services', to: '/console', icon: LayoutGrid },
    { title: 'Users', detail: 'Directory, invites, and linked emails', to: '/console/users', icon: Users },
    { title: 'Roles', detail: 'Built-in Root, Delivery lead, Contributor, Auditor', to: '/console/roles', icon: Shield },
    { title: 'Groups', detail: 'Organize members and attach roles', to: '/console/groups', icon: UsersRound },
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
        description="Organization identity, root access, invites, and shortcuts to governance and audit."
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
                <dd className="mt-1">
                  <StatusBadge status={data.user.role} label={roleDisplay(data.user.role)} />
                </dd>
              </div>
            </dl>
          </Card>
        )}
      </AsyncBoundary>

      {isRoot && (
        <Card
          title="Invite people"
          description="Root invites by email. Recipients sign in with that email (SSO) — passwords are never shared. Sandbox stores the email body instead of SMTP."
          data-testid="invite-panel"
        >
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onInvite}>
            <Field
              label="Email"
              className="min-w-0 flex-1"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@company.com"
              data-testid="invite-email"
            />
            <label className="block text-sm font-medium text-on-surface sm:w-44">
              <span>Role</span>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as InvitableRole)}
                data-testid="invite-role"
                className="mt-1.5 min-h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
              >
                {INVITE_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" loading={inviteBusy} data-testid="invite-submit">
              Send invite
            </Button>
          </form>
          {inviteError && (
            <p className="mt-2 text-sm text-error" data-testid="invite-error">
              {inviteError}
            </p>
          )}
          {lastPreview && (
            <pre
              className="mt-3 max-h-40 overflow-auto rounded-md bg-surface-container-low p-3 text-xs text-on-surface-variant"
              data-testid="invite-email-preview"
            >
              {lastPreview}
            </pre>
          )}

          <div className="mt-4 border-t border-outline-variant pt-4">
            <h3 className="text-sm font-semibold text-on-surface">Invites</h3>
            {invitesLoading ? (
              <p className="mt-2 text-sm text-on-surface-variant">Loading…</p>
            ) : invites.length === 0 ? (
              <p className="mt-2 text-sm text-on-surface-variant">No invites yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-outline-variant" data-testid="invite-list">
                {invites.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1 break-all font-medium">{inv.email}</span>
                    <StatusBadge status={inv.role} label={roleDisplay(inv.role)} />
                    <StatusBadge status={inv.status} label={humanize(inv.status)} />
                    {inv.status === 'pending' && (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void api.resendInvite(inv.id).then((r) => {
                            setLastPreview(r.emailDelivery.preview);
                            return loadInvites();
                          })}
                        >
                          Resend
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void api.revokeInvite(inv.id).then(() => loadInvites())}
                        >
                          Revoke
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}

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
        description="Identity import stub is available; secret vaults are not wired yet."
        actions={<StatusBadge status="unavailable" label="Partial" />}
      >
        <ul className="grid gap-3 text-sm text-on-surface-variant sm:grid-cols-3">
          {[
            { label: 'User invites (email stub)', icon: Users, ready: true, to: '/console/users' },
            { label: 'Import IAM from AWS / GCP', icon: CloudUpload, ready: true, to: '/console/iam-import' },
            { label: 'Integration secret management', icon: Shield, ready: false, to: null },
          ].map(({ label, icon: Icon, ready, to }) => (
            <li key={label} className="flex items-center gap-2">
              <Icon size={16} className="shrink-0" />
              {to && ready ? (
                <Link to={to} className="text-primary hover:underline">
                  {label}
                </Link>
              ) : (
                <span>
                  {label}
                  {!ready ? ' — unavailable' : ''}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </PageContainer>
  );
}
