import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api';
import type { InvitableRole, TenantUser } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import {
  AsyncBoundary,
  Button,
  Card,
  Field,
  PageContainer,
  PageHeader,
  ResponsiveDataList,
  StatusBadge,
} from '../components/ui';
import { roleDisplay } from '../lib/format';

const INVITE_ROLES: { id: InvitableRole; label: string }[] = [
  { id: 'manager', label: 'Delivery lead' },
  { id: 'engineer', label: 'Contributor' },
  { id: 'auditor', label: 'Auditor' },
];

export default function ConsoleUsers() {
  const me = useAsync(() => api.me(), []);
  const canManage = me.data?.user.role === 'root' || me.data?.user.role === 'manager';
  const isRoot = me.data?.user.role === 'root';
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>('manager');
  const [busy, setBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const load = async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.listIdentityUsers();
      setUsers(res.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const onInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!isRoot) return;
    setInviteError(null);
    setBusy(true);
    try {
      await api.createInvite({ email, role });
      setEmail('');
      await load();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer width="operational">
      <PageHeader
        eyebrow="Identity"
        title="Users"
        description="List workspace members, invite by email, and assign roles."
        actions={
          <Link to="/console/iam-import" className="text-sm font-medium text-primary hover:underline">
            Import from AWS / GCP
          </Link>
        }
      />

      <AsyncBoundary loading={me.loading || loading} error={me.error ?? error} onRetry={() => void load()}>
        {!canManage ? (
          <Card>
            <p className="text-sm text-on-surface-variant">Requires role: root or manager.</p>
          </Card>
        ) : (
          <div className="space-y-6">
            {isRoot && (
              <Card title="Invite people" description="Sandbox email delivery — invitees sign in with their own credentials.">
                <form onSubmit={onInvite} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                  <Field label="Email">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 text-sm outline-none focus:border-primary"
                      data-testid="console-invite-email"
                    />
                  </Field>
                  <Field label="Role">
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as InvitableRole)}
                      className="h-10 rounded-lg border border-outline-variant bg-surface-container-low px-3 text-sm"
                      data-testid="console-invite-role"
                    >
                      {INVITE_ROLES.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Button type="submit" loading={busy} data-testid="console-invite-submit">
                    Invite
                  </Button>
                </form>
                {inviteError && <p className="mt-2 text-sm text-error">{inviteError}</p>}
              </Card>
            )}

            <Card title="Directory" description={`${users.length} member(s)`}>
              <ResponsiveDataList
                items={users}
                getKey={(u) => u.id}
                caption="Workspace users"
                columns={[
                  { key: 'name', label: 'Name', render: (u) => u.displayName },
                  { key: 'email', label: 'Email', render: (u) => u.email },
                  {
                    key: 'role',
                    label: 'Role',
                    render: (u) => <StatusBadge status="info" label={roleDisplay(u.role)} />,
                  },
                  {
                    key: 'linked',
                    label: 'Linked emails',
                    render: (u) => (u.linkedEmails.length ? u.linkedEmails.join(', ') : '—'),
                  },
                  {
                    key: 'owner',
                    label: 'Owner',
                    render: (u) => (u.isWorkspaceOwner ? 'Yes' : '—'),
                  },
                ]}
              />
            </Card>
          </div>
        )}
      </AsyncBoundary>
    </PageContainer>
  );
}
