import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Shield } from 'lucide-react';
import { api } from '@shared/api';
import { MCP_PROVIDERS, type McpPermissionLevel } from '@shared/mcpProviders';
import {
  PLATFORM_CAPABILITIES,
  type CustomRole,
  type PlatformCapability,
  type RoleRule,
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
import { cn } from '../lib/utils';

const CONNECTABLE = MCP_PROVIDERS.filter((p) => p.connectable && p.availability !== 'none');

const CAPABILITY_LABELS: Record<PlatformCapability, string> = {
  'identity.read': 'Identity read',
  'identity.manage': 'Identity manage',
  'invites.manage': 'Invites',
  'groups.delete': 'Delete groups',
  'environments.manage': 'Environments',
  'boards.connect': 'Connect boards',
  'work_items.triage': 'Triage work items',
  'approvals.read': 'Approvals read',
  'approvals.decide': 'Approvals decide',
  'policies.manage': 'Policies',
  'mcp.connect': 'MCP connect',
  'notifications.manage': 'Notifications',
  'solutions.manage': 'Solutions',
  'learning.manage': 'Models & skills',
};

function summarizeRules(role: CustomRole): string[] {
  const lines: string[] = [];
  for (const rule of role.rules) {
    if (rule.kind === 'mcp_access') {
      lines.push(`MCP ${rule.serverId}: ${rule.permissionLevel}`);
    } else {
      lines.push(CAPABILITY_LABELS[rule.capability] ?? rule.capability);
    }
  }
  return lines;
}

export default function ConsoleRoles() {
  const me = useAsync(() => api.me(), []);
  const canManage = hasPlatformCapability(me.data?.user, 'identity.manage');
  const canRead = hasPlatformCapability(me.data?.user, 'identity.read') || canManage;

  const roles = useAsync(
    () => (canRead ? api.listIdentityRoles() : Promise.resolve({ roles: [] as CustomRole[] })),
    [canRead],
  );
  const users = useAsync(
    () =>
      canManage
        ? api.listIdentityUsers().catch(() => ({ users: [] }))
        : Promise.resolve({ users: [] }),
    [canManage],
  );

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mcpLevels, setMcpLevels] = useState<Record<string, McpPermissionLevel | ''>>({});
  const [platforms, setPlatforms] = useState<Set<PlatformCapability>>(new Set());
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const user of users.data?.users ?? []) {
      if (user.roleId) map.set(user.roleId, (map.get(user.roleId) ?? 0) + 1);
    }
    return map;
  }, [users.data]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setMcpLevels({});
    setPlatforms(new Set());
    setFormError(null);
  };

  const buildRules = (): RoleRule[] => {
    const rules: RoleRule[] = [];
    for (const [serverId, level] of Object.entries(mcpLevels)) {
      if (level) rules.push({ kind: 'mcp_access', serverId, permissionLevel: level });
    }
    for (const capability of platforms) {
      rules.push({ kind: 'platform', capability });
    }
    return rules;
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setFormError(null);
    try {
      await api.createIdentityRole({
        name,
        description,
        rules: buildRules(),
      });
      resetForm();
      setCreating(false);
      await roles.reload();
      await users.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create role');
    } finally {
      setBusy(false);
    }
  };

  const togglePlatform = (capability: PlatformCapability) => {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(capability)) next.delete(capability);
      else next.add(capability);
      return next;
    });
  };

  const roleList = roles.data?.roles ?? [];

  return (
    <PageContainer width="operational" data-testid="console-roles-page">
      <PageHeader
        eyebrow="Identity"
        title="Roles"
        description="Compose access from MCP provider grants and platform capabilities. Roles start empty — create what your workspace needs."
        actions={
          <div className="flex items-center gap-3">
            <Link to="/console/users" className="text-sm font-medium text-primary hover:underline">
              Manage users
            </Link>
            {canManage && (
              <Button
                type="button"
                data-testid="console-role-create-open"
                onClick={() => {
                  setCreating(true);
                  setFormError(null);
                }}
              >
                <Plus size={16} aria-hidden="true" />
                Create role
              </Button>
            )}
          </div>
        }
      />

      <AsyncBoundary loading={me.loading || roles.loading} error={me.error ?? roles.error} onRetry={roles.reload}>
        {!canRead ? (
          <Card>
            <p className="text-sm text-on-surface-variant">
              Requires capability: identity.read (or workspace owner).
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {creating && canManage && (
              <Card
                title="Create role"
                description="Pick MCP providers and platform capabilities. Nothing is pre-baked."
                data-testid="console-role-create-form"
              >
                <form onSubmit={(e) => void onCreate(e)} className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Delivery lead"
                      data-testid="console-role-name"
                    />
                    <Field
                      label="Description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Who this role is for"
                      data-testid="console-role-description"
                    />
                  </div>

                  <div>
                    <p className="text-sm font-medium text-on-surface">MCP access</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Grant a permission level per connectable provider.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {CONNECTABLE.map((provider) => {
                        const label = provider.serviceId
                          .split('_')
                          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                          .join(' ');
                        return (
                          <label
                            key={provider.serverId}
                            className="flex items-center justify-between gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm"
                          >
                            <span className="min-w-0 truncate text-on-surface">{label}</span>
                            <select
                              className="rounded-md border border-outline-variant bg-surface px-2 py-1 text-xs"
                              value={mcpLevels[provider.serverId] ?? ''}
                              data-testid={`console-role-mcp-${provider.serverId}`}
                              onChange={(e) => {
                                const value = e.target.value as McpPermissionLevel | '';
                                setMcpLevels((prev) => {
                                  const next = { ...prev };
                                  if (!value) delete next[provider.serverId];
                                  else next[provider.serverId] = value;
                                  return next;
                                });
                              }}
                            >
                              <option value="">Off</option>
                              {provider.permissionLevels.map((level) => (
                                <option key={level} value={level}>
                                  {level}
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-on-surface">Platform capabilities</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Console and API gates outside MCP tools.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {PLATFORM_CAPABILITIES.map((capability) => {
                        const active = platforms.has(capability);
                        return (
                          <button
                            key={capability}
                            type="button"
                            data-testid={`console-role-cap-${capability}`}
                            onClick={() => togglePlatform(capability)}
                            className={cn(
                              'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                              active
                                ? 'border-primary bg-primary-container text-on-primary-container'
                                : 'border-outline-variant text-on-surface-variant hover:bg-surface-container',
                            )}
                          >
                            {CAPABILITY_LABELS[capability]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {formError && (
                    <p className="text-sm text-error" data-testid="console-role-create-error">
                      {formError}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button type="submit" disabled={busy || !name.trim()} data-testid="console-role-create-submit">
                      {busy ? 'Creating…' : 'Create role'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setCreating(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            {roleList.length === 0 ? (
              <Card data-testid="console-roles-empty">
                <div className="flex flex-col items-start gap-3 py-4">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                    <Shield size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-on-surface">No roles yet</h2>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Create a role from MCP accesses and platform capabilities, then assign it on Users.
                    </p>
                  </div>
                  {canManage && !creating && (
                    <Button
                      type="button"
                      data-testid="console-roles-empty-create"
                      onClick={() => setCreating(true)}
                    >
                      <Plus size={16} aria-hidden="true" />
                      Create role
                    </Button>
                  )}
                </div>
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {roleList.map((role) => {
                  const memberCount = counts.get(role.id) ?? 0;
                  const summary = summarizeRules(role);
                  return (
                    <Card key={role.id} hierarchy="secondary" data-testid={`console-role-${role.id}`}>
                      <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                          <Shield size={18} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold text-on-surface">{role.name}</h2>
                            <StatusBadge
                              status={memberCount > 0 ? 'success' : 'neutral'}
                              label={`${memberCount} member${memberCount === 1 ? '' : 's'}`}
                            />
                          </div>
                          {role.description && (
                            <p className="mt-1 text-sm text-on-surface-variant">{role.description}</p>
                          )}
                          <div className="mt-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-on-surface-variant">
                              Rules
                            </p>
                            <ul className="mt-2 space-y-1.5">
                              {summary.map((line) => (
                                <li key={line} className="flex gap-2 text-sm text-on-surface">
                                  <span
                                    className="mt-2 size-1 shrink-0 rounded-full bg-primary"
                                    aria-hidden="true"
                                  />
                                  <span>{line}</span>
                                </li>
                              ))}
                              {summary.length === 0 && (
                                <li className="text-sm text-on-surface-variant">No rules yet.</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </AsyncBoundary>
    </PageContainer>
  );
}
