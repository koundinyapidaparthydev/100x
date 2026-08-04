import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api';
import type {
  CustomRole,
  IdentityGroup,
  TenantUser,
  UserEnvironmentGrant,
  WorkspaceEnvironment,
} from '@shared/types';
import { useAsync } from '../lib/useAsync';
import {
  AsyncBoundary,
  Button,
  Card,
  Field,
  PageContainer,
  PageHeader,
  StatusBadge,
} from '../components/ui';
import { hasPlatformCapability } from '../lib/rbac';
import { environmentDisplayName } from '../lib/environmentLabels';
import { roleDisplay, timeAgo } from '../lib/format';
import { cn } from '../lib/utils';

function initials(name: string, email: string): string {
  const source = name || email;
  const parts = source.replace(/^[^a-zA-Z0-9]+/, '').split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  return source.slice(0, 2).toUpperCase() || '??';
}

type EnvGrantEdit = { environmentId: string; roleId: string; enabled: boolean };

export default function ConsoleUsers() {
  const me = useAsync(() => api.me(), []);
  const canManage = hasPlatformCapability(me.data?.user, 'identity.manage');
  const canInvite = hasPlatformCapability(me.data?.user, 'invites.manage');
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [groups, setGroups] = useState<IdentityGroup[]>([]);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [environments, setEnvironments] = useState<WorkspaceEnvironment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editRoleId, setEditRoleId] = useState<string>('');
  const [editGroups, setEditGroups] = useState<string[]>([]);
  const [editLinked, setEditLinked] = useState('');
  const [editEnvGrants, setEditEnvGrants] = useState<EnvGrantEdit[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const roleName = (roleId: string | null) => {
    if (!roleId) return 'Unassigned';
    return roles.find((r) => r.id === roleId)?.name ?? roleDisplay(roleId);
  };

  const load = async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [usersRes, groupsRes, rolesRes, envRes] = await Promise.all([
        api.listIdentityUsers(),
        api.listIdentityGroups(),
        api.listIdentityRoles(),
        api.listEnvironments(),
      ]);
      setUsers(usersRes.users);
      setGroups(groupsRes.groups);
      setRoles(rolesRes.roles);
      setEnvironments(envRes.environments);
      if (!inviteRoleId && rolesRes.roles[0]) setInviteRoleId(rolesRes.roles[0].id);
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

  const selected = useMemo(
    () => users.find((u) => u.id === selectedId) ?? null,
    [users, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setEditRoleId(selected.roleId ?? '');
    setEditGroups([...selected.groupIds]);
    setEditLinked(selected.linkedEmails.join(', '));
    const byEnv = new Map(
      (selected.environmentGrants ?? []).map((g: UserEnvironmentGrant) => [g.environmentId, g]),
    );
    setEditEnvGrants(
      environments.map((env) => {
        const grant = byEnv.get(env.id);
        return {
          environmentId: env.id,
          roleId: grant?.roleId ?? '',
          enabled: Boolean(grant),
        };
      }),
    );
    setSaveError(null);
  }, [selected, environments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.linkedEmails.some((e) => e.includes(q)) ||
        roleName(u.roleId).toLowerCase().includes(q),
    );
  }, [users, query, roles]);

  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? id;
  const envName = (id: string) => {
    const env = environments.find((e) => e.id === id);
    return env ? environmentDisplayName(env.name, env.key) : id;
  };

  const onInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!canInvite) return;
    setInviteError(null);
    setBusy(true);
    try {
      if (!inviteRoleId) {
        setInviteError('Create a custom role before inviting members');
        return;
      }
      await api.createInvite({ email, roleId: inviteRoleId });
      setEmail('');
      await load();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setBusy(false);
    }
  };

  const onSaveUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !canManage) return;
    setSaving(true);
    setSaveError(null);
    try {
      const linkedEmails = editLinked
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const { user } = await api.updateIdentityUser(selected.id, {
        roleId: editRoleId || null,
        groupIds: editGroups,
        linkedEmails,
      });
      const { grants } = await api.setUserEnvironmentGrants(selected.id, {
        grants: editEnvGrants
          .filter((g) => g.enabled)
          .map((g) => ({
            environmentId: g.environmentId,
            roleId: g.roleId || null,
          })),
      });
      const next = { ...user, environmentGrants: grants };
      setUsers((prev) => prev.map((u) => (u.id === next.id ? next : u)));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not update user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer width="operational" data-testid="console-users-page">
      <PageHeader
        eyebrow="Identity"
        title="Users"
        description="Workspace directory — invite people, assign environments with per-env roles, and manage groups."
        actions={
          <Link to="/console/iam-import" className="text-sm font-medium text-primary hover:underline">
            Import from AWS / GCP
          </Link>
        }
      />

      <AsyncBoundary loading={me.loading || loading} error={me.error ?? error} onRetry={() => void load()}>
        {!canManage ? (
          <Card>
            <p className="text-sm text-on-surface-variant">
              Requires capability: identity.manage (or workspace owner).
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {canInvite && (
              <Card
                title="Invite people"
                description={
                  roles.length === 0
                    ? 'Create a custom role first, then invite teammates with that role.'
                    : 'Sandbox email delivery — invitees sign in with their own credentials.'
                }
              >
                <form
                  onSubmit={(e) => void onInvite(e)}
                  className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
                >
                  <Field
                    label="Email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    data-testid="console-invite-email"
                  />
                  <label className="block text-sm font-medium text-on-surface sm:w-44">
                    <span>Role</span>
                    <select
                      value={inviteRoleId}
                      onChange={(e) => setInviteRoleId(e.target.value)}
                      className="mt-1.5 min-h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
                      data-testid="console-invite-role"
                      disabled={roles.length === 0}
                    >
                      {roles.length === 0 && <option value="">No roles yet</option>}
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="submit"
                    disabled={busy || roles.length === 0}
                    data-testid="console-invite-submit"
                  >
                    {busy ? 'Sending…' : 'Send invite'}
                  </Button>
                </form>
                {inviteError && (
                  <p className="mt-2 text-sm text-error" data-testid="console-invite-error">
                    {inviteError}
                  </p>
                )}
              </Card>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
              <Card title="Directory" description={`${users.length} members`}>
                <Field
                  label="Search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name, email, or role"
                  data-testid="console-users-search"
                />
                <ul className="mt-4 divide-y divide-outline-variant">
                  {filtered.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(u.id)}
                        data-testid={`console-user-row-${u.id}`}
                        className={cn(
                          'flex w-full items-center gap-3 px-1 py-3 text-left transition-colors',
                          selectedId === u.id ? 'bg-primary-container/40' : 'hover:bg-surface-container',
                        )}
                      >
                        <span className="flex size-9 items-center justify-center rounded-full bg-surface-container text-xs font-semibold">
                          {initials(u.displayName, u.email)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold text-on-surface">
                              {u.displayName}
                            </span>
                            {u.isWorkspaceOwner && <StatusBadge status="success" label="Owner" />}
                            <StatusBadge status="info" label={roleName(u.roleId)} />
                            {(u.environmentGrants?.length ?? 0) > 0 && (
                              <StatusBadge
                                status="pending"
                                label={`${u.environmentGrants!.length} env`}
                              />
                            )}
                          </span>
                          <span className="block truncate text-xs text-on-surface-variant">
                            {u.email}
                            {u.lastLoginAt ? ` · ${timeAgo(u.lastLoginAt)}` : ''}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {filtered.length === 0 && (
                    <li className="py-6 text-sm text-on-surface-variant">No matching users.</li>
                  )}
                </ul>
              </Card>

              <Card title="Edit member" description={selected ? selected.email : 'Select a user'}>
                {!selected ? (
                  <p className="text-sm text-on-surface-variant">Choose someone from the directory.</p>
                ) : (
                  <form onSubmit={(e) => void onSaveUser(e)} className="space-y-3">
                    <label className="block text-sm font-medium text-on-surface">
                      <span>Default role</span>
                      <select
                        value={editRoleId}
                        onChange={(e) => setEditRoleId(e.target.value)}
                        className="mt-1.5 min-h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
                        data-testid="console-user-edit-role"
                        disabled={!canManage || selected.isWorkspaceOwner}
                      >
                        <option value="">Unassigned</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field
                      label="Linked emails"
                      value={editLinked}
                      onChange={(e) => setEditLinked(e.target.value)}
                      placeholder="work@company.com, …"
                      data-testid="console-user-edit-linked"
                    />
                    <fieldset>
                      <legend className="text-sm font-medium text-on-surface">Groups</legend>
                      <div className="mt-2 space-y-1.5">
                        {groups.map((g) => (
                          <label key={g.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={editGroups.includes(g.id)}
                              onChange={(e) => {
                                setEditGroups((prev) =>
                                  e.target.checked
                                    ? [...prev, g.id]
                                    : prev.filter((id) => id !== g.id),
                                );
                              }}
                            />
                            <span>{groupName(g.id)}</span>
                          </label>
                        ))}
                        {groups.length === 0 && (
                          <p className="text-xs text-on-surface-variant">No groups yet.</p>
                        )}
                      </div>
                    </fieldset>
                    {!selected.isWorkspaceOwner && (
                      <fieldset data-testid="console-user-env-grants">
                        <legend className="text-sm font-medium text-on-surface">
                          Environment access
                        </legend>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          Assign which environments this user may enter and the role for each.
                        </p>
                        <div className="mt-2 space-y-2">
                          {editEnvGrants.map((row) => (
                            <div
                              key={row.environmentId}
                              className="rounded-lg border border-outline-variant/70 p-2.5"
                            >
                              <label className="flex items-center gap-2 text-sm font-medium">
                                <input
                                  type="checkbox"
                                  checked={row.enabled}
                                  data-testid={`console-user-env-${row.environmentId}`}
                                  onChange={(e) => {
                                    setEditEnvGrants((prev) =>
                                      prev.map((g) =>
                                        g.environmentId === row.environmentId
                                          ? { ...g, enabled: e.target.checked }
                                          : g,
                                      ),
                                    );
                                  }}
                                />
                                <span>{envName(row.environmentId)}</span>
                              </label>
                              {row.enabled && (
                                <select
                                  value={row.roleId}
                                  data-testid={`console-user-env-role-${row.environmentId}`}
                                  onChange={(e) => {
                                    setEditEnvGrants((prev) =>
                                      prev.map((g) =>
                                        g.environmentId === row.environmentId
                                          ? { ...g, roleId: e.target.value }
                                          : g,
                                      ),
                                    );
                                  }}
                                  className="mt-2 min-h-9 w-full rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-sm"
                                >
                                  <option value="">Use default role</option>
                                  {roles.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          ))}
                          {environments.length === 0 && (
                            <p className="text-xs text-on-surface-variant">
                              No environments yet — create them under Console → Environments.
                            </p>
                          )}
                        </div>
                      </fieldset>
                    )}
                    {selected.isWorkspaceOwner && (
                      <p className="text-xs text-on-surface-variant">
                        Workspace owners have access to every environment.
                      </p>
                    )}
                    {saveError && <p className="text-sm text-error">{saveError}</p>}
                    <Button type="submit" disabled={saving} data-testid="console-user-save">
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </form>
                )}
              </Card>
            </div>
          </div>
        )}
      </AsyncBoundary>
    </PageContainer>
  );
}
