import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api';
import type { CustomRole, IdentityGroup, TenantUser } from '@shared/types';
import { hasPlatformCapability } from '../lib/rbac';
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
import { roleDisplay } from '../lib/format';
import { cn } from '../lib/utils';

export default function ConsoleGroups() {
  const me = useAsync(() => api.me(), []);
  const canManage = hasPlatformCapability(me.data?.user, 'identity.manage');
  const canDelete = hasPlatformCapability(me.data?.user, 'groups.delete');
  const canRead = hasPlatformCapability(me.data?.user, 'identity.read') || canManage;
  const [groups, setGroups] = useState<IdentityGroup[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [createRoles, setCreateRoles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editMembers, setEditMembers] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const roleLabel = (id: string) => roles.find((r) => r.id === id)?.name ?? roleDisplay(id);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupsRes, usersRes, rolesRes] = await Promise.all([
        canRead ? api.listIdentityGroups() : Promise.resolve({ groups: [] as IdentityGroup[] }),
        canManage
          ? api.listIdentityUsers()
          : Promise.resolve({ users: [] as TenantUser[] }),
        canRead ? api.listIdentityRoles() : Promise.resolve({ roles: [] as CustomRole[] }),
      ]);
      setGroups(groupsRes.groups);
      setUsers(usersRes.users);
      setRoles(rolesRes.roles);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (me.loading) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, canRead, me.loading]);

  const selected = useMemo(
    () => groups.find((g) => g.id === selectedId) ?? null,
    [groups, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setEditName(selected.name);
    setEditDescription(selected.description);
    setEditRoles([...selected.roleIds]);
    setEditMembers([...selected.memberIds]);
    setSaveError(null);
  }, [selected]);

  const memberLabel = (id: string) => {
    const user = users.find((u) => u.id === id);
    return user ? `${user.displayName} (${user.email})` : id;
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setCreateError(null);
    try {
      const { group } = await api.createIdentityGroup({
        name,
        description,
        roleIds: createRoles,
      });
      setName('');
      setDescription('');
      setCreateRoles([]);
      setGroups((prev) => [...prev, group].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedId(group.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !canManage) return;
    setBusy(true);
    setSaveError(null);
    try {
      const { group } = await api.updateIdentityGroup(selected.id, {
        name: editName,
        description: editDescription,
        roleIds: editRoles,
        memberIds: editMembers,
      });
      setGroups((prev) =>
        prev.map((g) => (g.id === group.id ? group : g)).sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!canDelete) return;
    setBusy(true);
    setSaveError(null);
    try {
      await api.deleteIdentityGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleRole = (list: string[], role: string, set: (next: string[]) => void) => {
    set(list.includes(role) ? list.filter((r) => r !== role) : [...list, role]);
  };

  return (
    <PageContainer width="operational" data-testid="console-groups-page">
      <PageHeader
        eyebrow="Identity"
        title="Groups"
        description="Organize members and attach custom roles you create under Roles."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link to="/console/roles" className="text-sm font-medium text-primary hover:underline">
              Open Roles
            </Link>
            <Link to="/console/users" className="text-sm font-medium text-primary hover:underline">
              Open Users
            </Link>
          </div>
        }
      />
      <AsyncBoundary loading={me.loading || loading} error={me.error ?? error} onRetry={() => void load()}>
        <div className="space-y-6">
          {canManage && (
            <Card title="Create group" description="Start with a name, optional description, and attached roles.">
              <form onSubmit={onCreate} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Delivery leads"
                    data-testid="console-group-name"
                  />
                  <Field
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="People who triage boards"
                  />
                </div>
                <fieldset>
                  <legend className="text-sm font-medium text-on-surface">Attached roles</legend>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {roles.map((role) => (
                      <label key={role.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={createRoles.includes(role.id)}
                          onChange={() => toggleRole(createRoles, role.id, setCreateRoles)}
                        />
                        {roleLabel(role.id)}
                      </label>
                    ))}
                    {roles.length === 0 && (
                      <p className="text-xs text-on-surface-variant">No custom roles yet.</p>
                    )}
                  </div>
                </fieldset>
                <Button type="submit" loading={busy} data-testid="console-group-create">
                  Create group
                </Button>
                {createError && (
                  <p className="text-sm text-error" role="alert">
                    {createError}
                  </p>
                )}
              </form>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <Card title="Groups" description={`${groups.length} group(s)`}>
              {groups.length === 0 ? (
                <p className="py-8 text-center text-sm text-on-surface-variant">
                  No groups yet. Create one to organize members.
                </p>
              ) : (
                <ul className="divide-y divide-outline-variant" data-testid="console-groups-list">
                  {groups.map((g) => {
                    const active = g.id === selectedId;
                    return (
                      <li key={g.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(g.id)}
                          className={cn(
                            'flex w-full flex-col gap-1 px-1 py-3 text-left transition-colors',
                            active ? 'bg-primary-container/40' : 'hover:bg-surface-container-low',
                          )}
                          data-testid={`console-group-row-${g.id}`}
                        >
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-on-surface">{g.name}</span>
                            <StatusBadge
                              status="neutral"
                              label={`${g.memberIds.length} member${g.memberIds.length === 1 ? '' : 's'}`}
                            />
                          </span>
                          <span className="text-xs text-on-surface-variant">
                            {g.description || 'No description'}
                          </span>
                          <span className="text-[11px] text-on-surface-variant">
                            Roles:{' '}
                            {g.roleIds.length
                              ? g.roleIds.map((r) => roleLabel(r)).join(', ')
                              : 'none'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card
              title={selected ? selected.name : 'Group details'}
              description={
                selected
                  ? 'Update membership, attached roles, and description.'
                  : 'Select a group to manage members and roles.'
              }
            >
              {!selected ? (
                <p className="py-10 text-center text-sm text-on-surface-variant">
                  Choose a group from the list.
                </p>
              ) : (
                <form onSubmit={onSave} className="space-y-4" data-testid="console-group-detail">
                  <Field
                    label="Name"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={!canManage}
                  />
                  <Field
                    label="Description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    disabled={!canManage}
                  />

                  <fieldset disabled={!canManage}>
                    <legend className="text-sm font-medium text-on-surface">Attached roles</legend>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {roles.map((role) => (
                        <label key={role.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editRoles.includes(role.id)}
                            onChange={() => toggleRole(editRoles, role.id, setEditRoles)}
                          />
                          {roleLabel(role.id)}
                        </label>
                      ))}
                      {roles.length === 0 && (
                        <p className="mt-1 text-xs text-on-surface-variant">No custom roles yet.</p>
                      )}
                    </div>
                  </fieldset>

                  <fieldset disabled={!canManage}>
                    <legend className="text-sm font-medium text-on-surface">Members</legend>
                    {users.length === 0 ? (
                      <p className="mt-2 text-xs text-on-surface-variant">
                        User directory unavailable or empty.
                      </p>
                    ) : (
                      <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                        {users.map((user) => {
                          const checked = editMembers.includes(user.id);
                          return (
                            <li key={user.id}>
                              <label className="flex items-start gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="mt-1"
                                  checked={checked}
                                  onChange={(e) => {
                                    setEditMembers((prev) =>
                                      e.target.checked
                                        ? [...prev, user.id]
                                        : prev.filter((id) => id !== user.id),
                                    );
                                  }}
                                />
                                <span>
                                  <span className="font-medium text-on-surface">{user.displayName}</span>
                                  <span className="block text-xs text-on-surface-variant">
                                    {user.email} · {user.isWorkspaceOwner ? 'Owner' : roleLabel(user.roleId ?? '')}
                                  </span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {selected.memberIds.length > 0 && users.length === 0 && (
                      <p className="mt-2 text-xs text-on-surface-variant">
                        Member IDs: {selected.memberIds.map(memberLabel).join(', ')}
                      </p>
                    )}
                  </fieldset>

                  {saveError && (
                    <p className="text-sm text-error" role="alert">
                      {saveError}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {canManage && (
                      <Button type="submit" loading={busy} data-testid="console-group-save">
                        Save changes
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        type="button"
                        variant="danger"
                        disabled={busy}
                        onClick={() => void onDelete(selected.id)}
                        data-testid="console-group-delete"
                      >
                        Delete group
                      </Button>
                    )}
                  </div>
                </form>
              )}
            </Card>
          </div>
        </div>
      </AsyncBoundary>
    </PageContainer>
  );
}
