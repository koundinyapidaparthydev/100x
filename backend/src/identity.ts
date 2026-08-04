/**
 * Workspace identity: users, groups, custom roles, services catalog, IAM import stub.
 */

import { MCP_PROVIDERS, type McpPermissionLevel } from '../../shared/mcpProviders';
import type {
  AuthUser,
  ConsoleServiceRecord,
  CreateCustomRoleRequest,
  CreateIdentityGroupRequest,
  CustomRole,
  IamImportJob,
  IamImportRequest,
  IamImportSource,
  IdentityGroup,
  PlatformCapability,
  RoleRule,
  TenantUser,
  UpdateCustomRoleRequest,
  UpdateIdentityGroupRequest,
  UpdateTenantUserRequest,
  UserEnvironmentGrant,
  WorkspaceSetupRequest,
} from '../../shared/types';
import { PLATFORM_CAPABILITIES } from '../../shared/types';
import { nextId, TENANT_ID, type Store } from './store';

const MCP_LEVEL_RANK: Record<McpPermissionLevel, number> = { read: 0, write: 1, admin: 2 };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function domainFromEmail(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

function normalizeDomain(raw: string | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim().toLowerCase();
  if (!value) return null;
  value = value.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  if (!value.includes('.') || /\s/.test(value)) return null;
  return value;
}

function connectableServerIds(): Set<string> {
  return new Set(
    MCP_PROVIDERS.filter((p) => p.connectable && p.availability !== 'none').map((p) => p.serverId),
  );
}

export function isPlatformCapability(value: string): value is PlatformCapability {
  return (PLATFORM_CAPABILITIES as string[]).includes(value);
}

export function validateRoleRules(rules: RoleRule[]): RoleRule[] {
  const servers = connectableServerIds();
  const out: RoleRule[] = [];
  for (const rule of rules) {
    if (rule.kind === 'platform') {
      if (!isPlatformCapability(rule.capability)) {
        throw Object.assign(new Error(`unknown platform capability: ${rule.capability}`), {
          status: 400,
        });
      }
      out.push({ kind: 'platform', capability: rule.capability });
      continue;
    }
    if (rule.kind === 'mcp_access') {
      const serverId = typeof rule.serverId === 'string' ? rule.serverId.trim() : '';
      if (!serverId || !servers.has(serverId)) {
        throw Object.assign(new Error(`unknown MCP serverId: ${rule.serverId}`), { status: 400 });
      }
      const level = rule.permissionLevel;
      if (level !== 'read' && level !== 'write' && level !== 'admin') {
        throw Object.assign(new Error('permissionLevel must be read, write, or admin'), {
          status: 400,
        });
      }
      const provider = MCP_PROVIDERS.find((p) => p.serverId === serverId);
      if (provider && !provider.permissionLevels.includes(level)) {
        throw Object.assign(
          new Error(`permission level '${level}' is not offered for ${serverId}`),
          { status: 400 },
        );
      }
      out.push({ kind: 'mcp_access', serverId, permissionLevel: level });
      continue;
    }
    throw Object.assign(new Error('invalid role rule kind'), { status: 400 });
  }
  return out;
}

export function listCustomRoles(store: Store, tenantId = TENANT_ID): CustomRole[] {
  return [...(store.rolesByTenant[tenantId] ?? [])].sort((a, b) => a.name.localeCompare(b.name));
}

export function findCustomRole(
  store: Store,
  roleId: string,
  tenantId = TENANT_ID,
): CustomRole | null {
  return (store.rolesByTenant[tenantId] ?? []).find((r) => r.id === roleId) ?? null;
}

export function createCustomRole(
  store: Store,
  actor: AuthUser,
  input: CreateCustomRoleRequest,
): CustomRole {
  assertActorPlatform(store, actor, 'identity.manage');
  const name = input.name?.trim();
  if (!name) {
    throw Object.assign(new Error('role name is required'), { status: 400 });
  }
  const now = new Date().toISOString();
  const role: CustomRole = {
    id: nextId('role'),
    tenantId: actor.tenantId,
    name,
    description: (input.description ?? '').trim(),
    subject: 'user',
    rules: validateRoleRules(input.rules ?? []),
    createdAt: now,
    updatedAt: now,
  };
  if (!store.rolesByTenant[actor.tenantId]) store.rolesByTenant[actor.tenantId] = [];
  store.rolesByTenant[actor.tenantId]!.push(role);
  return role;
}

export function updateCustomRole(
  store: Store,
  actor: AuthUser,
  roleId: string,
  input: UpdateCustomRoleRequest,
): CustomRole {
  assertActorPlatform(store, actor, 'identity.manage');
  const role = findCustomRole(store, roleId, actor.tenantId);
  if (!role) {
    throw Object.assign(new Error('role not found'), { status: 404 });
  }
  if (typeof input.name === 'string' && input.name.trim()) role.name = input.name.trim();
  if (typeof input.description === 'string') role.description = input.description.trim();
  if (input.rules) role.rules = validateRoleRules(input.rules);
  role.updatedAt = new Date().toISOString();
  return role;
}

export function deleteCustomRole(store: Store, actor: AuthUser, roleId: string): void {
  assertActorPlatform(store, actor, 'identity.manage');
  const roles = store.rolesByTenant[actor.tenantId] ?? [];
  const idx = roles.findIndex((r) => r.id === roleId);
  if (idx < 0) {
    throw Object.assign(new Error('role not found'), { status: 404 });
  }
  roles.splice(idx, 1);
  for (const user of listTenantUsers(store, actor.tenantId)) {
    if (user.roleId === roleId) {
      user.roleId = null;
      user.updatedAt = new Date().toISOString();
    }
  }
  for (const group of listGroups(store, actor.tenantId)) {
    if (group.roleIds.includes(roleId)) {
      group.roleIds = group.roleIds.filter((id) => id !== roleId);
      group.updatedAt = new Date().toISOString();
    }
  }
  const grants = store.environmentGrantsByTenant[actor.tenantId] ?? [];
  for (const grant of grants) {
    if (grant.roleId === roleId) grant.roleId = null;
  }
}

function tenantEnvGrants(store: Store, tenantId: string): UserEnvironmentGrant[] {
  if (!store.environmentGrantsByTenant[tenantId]) {
    store.environmentGrantsByTenant[tenantId] = [];
  }
  return store.environmentGrantsByTenant[tenantId]!;
}

export function isWorkspaceOwnerUser(store: Store, user: AuthUser): boolean {
  if (user.isWorkspaceOwner) return true;
  const stored = findTenantUser(store, user.id, user.tenantId);
  return stored?.isWorkspaceOwner === true;
}

export function listGrantsForUser(
  store: Store,
  tenantId: string,
  userId: string,
): UserEnvironmentGrant[] {
  return tenantEnvGrants(store, tenantId).filter((g) => g.userId === userId);
}

export function findUserEnvGrant(
  store: Store,
  tenantId: string,
  userId: string,
  environmentId: string,
): UserEnvironmentGrant | null {
  return (
    tenantEnvGrants(store, tenantId).find(
      (g) => g.userId === userId && g.environmentId === environmentId,
    ) ?? null
  );
}

export function userCanAccessEnvironment(
  store: Store,
  actor: AuthUser,
  environmentId: string,
): boolean {
  if (isWorkspaceOwnerUser(store, actor)) return true;
  return Boolean(findUserEnvGrant(store, actor.tenantId, actor.id, environmentId));
}

/**
 * Role id effective for the actor in a given environment.
 * Owner → null (bypass). Grant membership required for non-owners.
 */
export function effectiveRoleIdForEnvironment(
  store: Store,
  actor: AuthUser,
  environmentId: string,
): string | null {
  if (isWorkspaceOwnerUser(store, actor)) return null;
  const grant = findUserEnvGrant(store, actor.tenantId, actor.id, environmentId);
  if (!grant) return null;
  if (grant.roleId) return grant.roleId;
  const stored = findTenantUser(store, actor.id, actor.tenantId);
  return stored?.roleId ?? actor.roleId ?? null;
}

/** Active-env role id (or null for owner / no grant). */
export function effectiveRoleIdForActiveEnv(store: Store, actor: AuthUser): string | null {
  const envId = store.activeEnvironmentByTenant[actor.tenantId] ?? '';
  if (!envId) {
    if (isWorkspaceOwnerUser(store, actor)) return null;
    const stored = findTenantUser(store, actor.id, actor.tenantId);
    return stored?.roleId ?? actor.roleId ?? null;
  }
  if (isWorkspaceOwnerUser(store, actor)) return null;
  if (!userCanAccessEnvironment(store, actor, envId)) return null;
  return effectiveRoleIdForEnvironment(store, actor, envId);
}

/** Inline rules on the active-env grant (if any). */
function activeEnvGrantRules(store: Store, actor: AuthUser): RoleRule[] {
  const envId = store.activeEnvironmentByTenant[actor.tenantId] ?? '';
  if (!envId) return [];
  const grant = findUserEnvGrant(store, actor.tenantId, actor.id, envId);
  return grant?.rules ?? [];
}

export function getUserEnvironmentGrants(
  store: Store,
  tenantId: string,
  userId: string,
): UserEnvironmentGrant[] {
  return listGrantsForUser(store, tenantId, userId);
}

export function setUserEnvironmentGrants(
  store: Store,
  actor: AuthUser,
  userId: string,
  input: Array<{
    environmentId: string;
    roleId: string | null;
    rules?: UserEnvironmentGrant['rules'];
  }>,
): UserEnvironmentGrant[] {
  assertActorPlatform(store, actor, 'identity.manage');
  const user = findTenantUser(store, userId, actor.tenantId);
  if (!user) {
    throw Object.assign(new Error('user not found'), { status: 404 });
  }
  const envs = store.environmentsByTenant[actor.tenantId] ?? [];
  const envIds = new Set(envs.map((e) => e.id));
  if (envIds.size === 0) {
    throw Object.assign(new Error('no environments configured'), { status: 400 });
  }
  const next: UserEnvironmentGrant[] = [];
  const seen = new Set<string>();
  for (const row of input) {
    const environmentId = typeof row.environmentId === 'string' ? row.environmentId.trim() : '';
    if (!environmentId || !envIds.has(environmentId)) {
      throw Object.assign(new Error(`unknown environmentId: ${row.environmentId}`), {
        status: 400,
      });
    }
    if (seen.has(environmentId)) {
      throw Object.assign(new Error(`duplicate environmentId: ${environmentId}`), { status: 400 });
    }
    seen.add(environmentId);
    let roleId: string | null = null;
    if (row.roleId !== null && row.roleId !== undefined && row.roleId !== '') {
      if (!findCustomRole(store, row.roleId, actor.tenantId)) {
        throw Object.assign(new Error('role not found'), { status: 400 });
      }
      roleId = row.roleId;
    }
    const grant: UserEnvironmentGrant = {
      userId,
      environmentId,
      roleId,
    };
    if (row.rules) {
      grant.rules = validateRoleRules(row.rules);
    }
    next.push(grant);
  }

  const grants = tenantEnvGrants(store, actor.tenantId);
  const kept = grants.filter((g) => g.userId !== userId);
  store.environmentGrantsByTenant[actor.tenantId] = [...kept, ...next];
  return next;
}

/** Owner bypass or role includes every listed platform capability (active env). */
export function roleHasPlatform(
  store: Store,
  user: AuthUser,
  ...capabilities: PlatformCapability[]
): boolean {
  if (isWorkspaceOwnerUser(store, user)) return true;
  if (!capabilities.length) return true;
  const envId = store.activeEnvironmentByTenant[user.tenantId] ?? '';
  if (envId && !userCanAccessEnvironment(store, user, envId)) return false;
  const roleId = effectiveRoleIdForActiveEnv(store, user);
  const role = roleId ? findCustomRole(store, roleId, user.tenantId) : null;
  const granted = new Set<PlatformCapability>();
  if (role) {
    for (const r of role.rules) {
      if (r.kind === 'platform') granted.add(r.capability);
    }
  }
  for (const r of activeEnvGrantRules(store, user)) {
    if (r.kind === 'platform') granted.add(r.capability);
  }
  return capabilities.every((c) => granted.has(c));
}

/**
 * Highest MCP permission level granted by the user's active-env role for a server.
 * Owner → 'admin' (full). Missing grant → null.
 */
export function roleMcpLevel(
  store: Store,
  user: AuthUser,
  serverId: string,
): McpPermissionLevel | null {
  if (isWorkspaceOwnerUser(store, user)) return 'admin';
  const envId = store.activeEnvironmentByTenant[user.tenantId] ?? '';
  if (envId && !userCanAccessEnvironment(store, user, envId)) return null;
  const roleId = effectiveRoleIdForActiveEnv(store, user);
  const role = roleId ? findCustomRole(store, roleId, user.tenantId) : null;
  let best: McpPermissionLevel | null = null;
  const consider = (level: McpPermissionLevel) => {
    if (!best || MCP_LEVEL_RANK[level] > MCP_LEVEL_RANK[best]) best = level;
  };
  if (role) {
    for (const rule of role.rules) {
      if (rule.kind === 'mcp_access' && rule.serverId === serverId) {
        consider(rule.permissionLevel);
      }
    }
  }
  for (const rule of activeEnvGrantRules(store, user)) {
    if (rule.kind === 'mcp_access' && rule.serverId === serverId) {
      consider(rule.permissionLevel);
    }
  }
  return best;
}

export function minMcpLevel(a: McpPermissionLevel, b: McpPermissionLevel): McpPermissionLevel {
  return MCP_LEVEL_RANK[a] <= MCP_LEVEL_RANK[b] ? a : b;
}

export function effectivePlatformCapabilities(store: Store, user: AuthUser): PlatformCapability[] {
  if (isWorkspaceOwnerUser(store, user)) return [...PLATFORM_CAPABILITIES];
  const envId = store.activeEnvironmentByTenant[user.tenantId] ?? '';
  if (envId && !userCanAccessEnvironment(store, user, envId)) return [];
  const roleId = effectiveRoleIdForActiveEnv(store, user);
  const role = roleId ? findCustomRole(store, roleId, user.tenantId) : null;
  const granted = new Set<PlatformCapability>();
  if (role) {
    for (const r of role.rules) {
      if (r.kind === 'platform') granted.add(r.capability);
    }
  }
  for (const r of activeEnvGrantRules(store, user)) {
    if (r.kind === 'platform') granted.add(r.capability);
  }
  return [...granted];
}

function assertActorPlatform(
  store: Store,
  actor: AuthUser,
  ...capabilities: PlatformCapability[]
): void {
  if (!roleHasPlatform(store, actor, ...capabilities)) {
    throw Object.assign(new Error(`requires capability: ${capabilities.join(' | ')}`), {
      status: 403,
    });
  }
}

export function listTenantUsers(store: Store, tenantId = TENANT_ID): TenantUser[] {
  return [...(store.usersByTenant[tenantId] ?? [])]
    .map((u) => ({
      ...u,
      environmentGrants: listGrantsForUser(store, tenantId, u.id),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function findTenantUser(store: Store, userId: string, tenantId = TENANT_ID): TenantUser | null {
  return (store.usersByTenant[tenantId] ?? []).find((u) => u.id === userId) ?? null;
}

export function authUserFromTenant(user: TenantUser, surface: AuthUser['surface']): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roleId: user.roleId,
    tenantId: user.tenantId,
    surface,
    companyDomain: user.companyDomain ?? undefined,
    linkedEmails: user.linkedEmails.length ? [...user.linkedEmails] : undefined,
    isWorkspaceOwner: user.isWorkspaceOwner,
    workspaceSetupComplete: user.workspaceSetupComplete,
  };
}

/** Merge persisted identity fields onto the session user (for /auth/me). */
export function enrichAuthUser(store: Store, user: AuthUser): AuthUser {
  const stored = findTenantUser(store, user.id, user.tenantId);
  const base = stored
    ? {
        ...user,
        roleId: stored.roleId,
        companyDomain: stored.companyDomain ?? undefined,
        linkedEmails: stored.linkedEmails.length ? [...stored.linkedEmails] : undefined,
        isWorkspaceOwner: stored.isWorkspaceOwner,
        workspaceSetupComplete: stored.workspaceSetupComplete,
        displayName: stored.displayName || user.displayName,
        email: stored.email || user.email,
      }
    : user;
  return {
    ...base,
    platformCapabilities: effectivePlatformCapabilities(store, base),
  };
}

/**
 * Upsert a federated / demo user into the tenant directory.
 * Signup without invite → workspace owner with setup incomplete.
 */
export function upsertTenantUserFromAuth(
  store: Store,
  user: AuthUser,
  opts?: { isNewSignup?: boolean; fromInvite?: boolean },
): TenantUser {
  if (!store.usersByTenant[user.tenantId]) store.usersByTenant[user.tenantId] = [];
  const list = store.usersByTenant[user.tenantId]!;
  const now = new Date().toISOString();
  const existing = list.find((u) => u.id === user.id);
  if (existing) {
    existing.email = normalizeEmail(user.email);
    existing.displayName = user.displayName;
    if (user.roleId !== undefined) existing.roleId = user.roleId;
    existing.lastLoginAt = now;
    existing.updatedAt = now;
    if (opts?.fromInvite) {
      existing.isWorkspaceOwner = false;
      existing.workspaceSetupComplete = true;
    }
    if (user.isWorkspaceOwner !== undefined) {
      existing.isWorkspaceOwner = user.isWorkspaceOwner;
    }
    return existing;
  }

  const created: TenantUser = {
    id: user.id,
    tenantId: user.tenantId,
    email: normalizeEmail(user.email),
    displayName: user.displayName,
    roleId: user.roleId ?? null,
    linkedEmails: [],
    companyDomain: domainFromEmail(user.email),
    isWorkspaceOwner:
      user.isWorkspaceOwner === true ||
      (opts?.isNewSignup === true && !opts?.fromInvite && !user.roleId),
    workspaceSetupComplete: opts?.fromInvite === true || user.id.startsWith('usr-'),
    groupIds: [],
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };
  list.push(created);
  return created;
}

export function completeWorkspaceSetup(
  store: Store,
  actor: AuthUser,
  input: WorkspaceSetupRequest,
): AuthUser {
  const stored = findTenantUser(store, actor.id, actor.tenantId);
  if (!stored) {
    throw Object.assign(new Error('user not found in workspace directory'), { status: 404 });
  }

  const companyDomain =
    normalizeDomain(input.companyDomain) ??
    normalizeDomain(input.companyWebsite) ??
    normalizeDomain(input.parentCompanyDomain) ??
    domainFromEmail(actor.email);

  const linkedEmails = [...stored.linkedEmails];
  if (typeof input.workEmail === 'string' && input.workEmail.trim()) {
    const work = normalizeEmail(input.workEmail);
    if (!isValidEmail(work)) {
      throw Object.assign(new Error('work email is invalid'), { status: 400 });
    }
    if (work !== normalizeEmail(stored.email) && !linkedEmails.includes(work)) {
      linkedEmails.push(work);
    }
  }

  const now = new Date().toISOString();
  stored.companyDomain = companyDomain;
  stored.linkedEmails = linkedEmails;
  stored.workspaceSetupComplete = true;
  stored.updatedAt = now;

  if (input.belongsToParentCompany) {
    if (!normalizeDomain(input.parentCompanyDomain) && !companyDomain) {
      throw Object.assign(new Error('parent company domain is required'), { status: 400 });
    }
    stored.isWorkspaceOwner = false;
    // Keep invite-assigned role if set; otherwise remain unassigned until an admin assigns one.
  } else {
    stored.isWorkspaceOwner = true;
    stored.roleId = null;
  }

  void input.isPrimaryGoogleAccount;

  return enrichAuthUser(store, authUserFromTenant(stored, actor.surface));
}

export function updateTenantUser(
  store: Store,
  actor: AuthUser,
  userId: string,
  input: UpdateTenantUserRequest,
): TenantUser {
  assertActorPlatform(store, actor, 'identity.manage');
  const user = findTenantUser(store, userId, actor.tenantId);
  if (!user) {
    throw Object.assign(new Error('user not found'), { status: 404 });
  }
  if (input.roleId !== undefined) {
    if (input.roleId === null) {
      user.roleId = null;
    } else {
      if (!findCustomRole(store, input.roleId, actor.tenantId)) {
        throw Object.assign(new Error('role not found'), { status: 400 });
      }
      user.roleId = input.roleId;
    }
  }
  if (input.linkedEmails) {
    user.linkedEmails = input.linkedEmails.map(normalizeEmail).filter(isValidEmail);
  }
  if (input.groupIds) {
    const groups = store.groupsByTenant[actor.tenantId] ?? [];
    const valid = new Set(groups.map((g) => g.id));
    user.groupIds = input.groupIds.filter((id) => valid.has(id));
    for (const group of groups) {
      const shouldBelong = user.groupIds.includes(group.id);
      const has = group.memberIds.includes(user.id);
      if (shouldBelong && !has) group.memberIds.push(user.id);
      if (!shouldBelong && has) group.memberIds = group.memberIds.filter((id) => id !== user.id);
      group.updatedAt = new Date().toISOString();
    }
  }
  user.updatedAt = new Date().toISOString();
  return user;
}

export function listGroups(store: Store, tenantId = TENANT_ID): IdentityGroup[] {
  return [...(store.groupsByTenant[tenantId] ?? [])].sort((a, b) => a.name.localeCompare(b.name));
}

function filterValidRoleIds(store: Store, tenantId: string, roleIds: string[] | undefined): string[] {
  if (!roleIds?.length) return [];
  const valid = new Set(listCustomRoles(store, tenantId).map((r) => r.id));
  return roleIds.filter((id) => valid.has(id));
}

export function createGroup(
  store: Store,
  actor: AuthUser,
  input: CreateIdentityGroupRequest,
): IdentityGroup {
  assertActorPlatform(store, actor, 'identity.manage');
  const name = input.name?.trim();
  if (!name) {
    throw Object.assign(new Error('group name is required'), { status: 400 });
  }
  const now = new Date().toISOString();
  const group: IdentityGroup = {
    id: nextId('grp'),
    tenantId: actor.tenantId,
    name,
    description: (input.description ?? '').trim(),
    roleIds: filterValidRoleIds(store, actor.tenantId, input.roleIds),
    memberIds: input.memberIds ?? [],
    createdAt: now,
    updatedAt: now,
  };
  if (!store.groupsByTenant[actor.tenantId]) store.groupsByTenant[actor.tenantId] = [];
  store.groupsByTenant[actor.tenantId]!.push(group);

  for (const memberId of group.memberIds) {
    const user = findTenantUser(store, memberId, actor.tenantId);
    if (user && !user.groupIds.includes(group.id)) {
      user.groupIds.push(group.id);
      user.updatedAt = now;
    }
  }
  return group;
}

export function updateGroup(
  store: Store,
  actor: AuthUser,
  groupId: string,
  input: UpdateIdentityGroupRequest,
): IdentityGroup {
  assertActorPlatform(store, actor, 'identity.manage');
  const group = listGroups(store, actor.tenantId).find((g) => g.id === groupId);
  if (!group) {
    throw Object.assign(new Error('group not found'), { status: 404 });
  }
  const now = new Date().toISOString();
  if (typeof input.name === 'string' && input.name.trim()) group.name = input.name.trim();
  if (typeof input.description === 'string') group.description = input.description.trim();
  if (input.roleIds) {
    group.roleIds = filterValidRoleIds(store, actor.tenantId, input.roleIds);
  }
  if (input.memberIds) {
    const prev = new Set(group.memberIds);
    const next = new Set(input.memberIds);
    group.memberIds = [...next];
    for (const user of listTenantUsers(store, actor.tenantId)) {
      const shouldBelong = next.has(user.id);
      const had = prev.has(user.id);
      if (shouldBelong && !user.groupIds.includes(group.id)) {
        user.groupIds.push(group.id);
        user.updatedAt = now;
      } else if (!shouldBelong && had) {
        user.groupIds = user.groupIds.filter((id) => id !== group.id);
        user.updatedAt = now;
      }
    }
  }
  group.updatedAt = now;
  return group;
}

export function deleteGroup(store: Store, actor: AuthUser, groupId: string): void {
  assertActorPlatform(store, actor, 'groups.delete');
  const groups = store.groupsByTenant[actor.tenantId] ?? [];
  const idx = groups.findIndex((g) => g.id === groupId);
  if (idx < 0) {
    throw Object.assign(new Error('group not found'), { status: 404 });
  }
  groups.splice(idx, 1);
  for (const user of listTenantUsers(store, actor.tenantId)) {
    if (user.groupIds.includes(groupId)) {
      user.groupIds = user.groupIds.filter((id) => id !== groupId);
      user.updatedAt = new Date().toISOString();
    }
  }
}

export function listConsoleServices(
  store: Store,
  tenantId = TENANT_ID,
  environmentId?: string,
): ConsoleServiceRecord[] {
  const envId = environmentId ?? store.activeEnvironmentByTenant[tenantId] ?? '';
  const connections = (store.mcpConnectionsByTenant[tenantId] ?? []).filter(
    (c) => !envId || c.environmentId === envId,
  );
  const byId = new Map(connections.map((c) => [c.serviceId, c]));
  return MCP_PROVIDERS.filter((p) => p.availability !== 'none').map((provider) => {
    const conn = byId.get(provider.serviceId);
    const name = provider.serviceId
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    return {
      id: provider.serviceId,
      name,
      category: provider.availability,
      availability: provider.availability,
      connected: Boolean(conn),
      permissionLevel: conn?.permissionLevel ?? null,
      source: 'mcp' as const,
      notes: provider.notes,
    };
  });
}

const IMPORT_SOURCES: IamImportSource[] = ['aws_iam', 'gcp_iam', 'csv', 'json'];

export function createIamImportJob(
  store: Store,
  actor: AuthUser,
  input: IamImportRequest,
): IamImportJob {
  assertActorPlatform(store, actor, 'identity.manage');
  if (!IMPORT_SOURCES.includes(input.source)) {
    throw Object.assign(new Error('unsupported IAM import source'), { status: 400 });
  }

  const payload = (input.payload ?? '').trim();
  let mappedUsers = 0;
  let mappedGroups = 0;
  if (payload) {
    try {
      if (input.source === 'csv' || payload.includes(',')) {
        const lines = payload.split(/\r?\n/).filter((l) => l.trim());
        mappedUsers = Math.max(0, lines.length - 1);
      } else {
        const parsed = JSON.parse(payload) as {
          Users?: unknown[];
          users?: unknown[];
          Groups?: unknown[];
          groups?: unknown[];
        };
        mappedUsers = (parsed.Users ?? parsed.users ?? []).length;
        mappedGroups = (parsed.Groups ?? parsed.groups ?? []).length;
      }
    } catch {
      mappedUsers = payload.length > 0 ? 1 : 0;
    }
  } else if (input.connectedCloudAccount) {
    mappedUsers = 0;
    mappedGroups = 0;
  }

  const job: IamImportJob = {
    id: nextId('iamimport'),
    tenantId: actor.tenantId,
    source: input.source,
    status: 'preview',
    summary: input.connectedCloudAccount
      ? `Stub import queued from connected account ${input.connectedCloudAccount}. Live sync ships in Phase 2.`
      : `Stub import preview from ${input.source}: ${mappedUsers} user(s), ${mappedGroups} group(s). No live cloud pull yet.`,
    createdAt: new Date().toISOString(),
    createdByUserId: actor.id,
    mappedUsers,
    mappedGroups,
  };
  store.iamImportJobs.push(job);
  return job;
}

export function listIamImportJobs(store: Store, tenantId = TENANT_ID): IamImportJob[] {
  return store.iamImportJobs
    .filter((j) => j.tenantId === tenantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
