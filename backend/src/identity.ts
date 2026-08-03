/**
 * Workspace identity: users, groups, built-in roles, services catalog, IAM import stub.
 */

import { MCP_PROVIDERS } from '../../shared/mcpProviders';
import type {
  AuthUser,
  BuiltInRoleDefinition,
  ConsoleServiceRecord,
  CreateIdentityGroupRequest,
  IamImportJob,
  IamImportRequest,
  IamImportSource,
  IdentityGroup,
  TenantUser,
  UpdateIdentityGroupRequest,
  UpdateTenantUserRequest,
  UserRole,
  WorkspaceSetupRequest,
} from '../../shared/types';
import { nextId, TENANT_ID, type Store } from './store';

const BUILT_IN_ROLES: BuiltInRoleDefinition[] = [
  {
    id: 'root',
    label: 'Root',
    description: 'Workspace owner — full access including invites, identity, and governance.',
    builtIn: true,
  },
  {
    id: 'manager',
    label: 'Delivery lead',
    description: 'Triage, approvals, and delivery operations.',
    builtIn: true,
  },
  {
    id: 'engineer',
    label: 'Contributor',
    description: 'Contribute to work items; limited admin surface.',
    builtIn: true,
  },
  {
    id: 'auditor',
    label: 'Auditor',
    description: 'Read-focused access for reviews and audit trails.',
    builtIn: true,
  },
];

const ALL_ROLES: UserRole[] = ['root', 'manager', 'engineer', 'auditor'];

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

export function listBuiltInRoles(): BuiltInRoleDefinition[] {
  return BUILT_IN_ROLES.map((r) => ({ ...r }));
}

export function listTenantUsers(store: Store, tenantId = TENANT_ID): TenantUser[] {
  return [...(store.usersByTenant[tenantId] ?? [])].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
}

export function findTenantUser(store: Store, userId: string, tenantId = TENANT_ID): TenantUser | null {
  return (store.usersByTenant[tenantId] ?? []).find((u) => u.id === userId) ?? null;
}

export function authUserFromTenant(user: TenantUser, surface: AuthUser['surface']): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
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
  if (!stored) return user;
  return {
    ...user,
    role: stored.role,
    companyDomain: stored.companyDomain ?? undefined,
    linkedEmails: stored.linkedEmails.length ? [...stored.linkedEmails] : undefined,
    isWorkspaceOwner: stored.isWorkspaceOwner,
    workspaceSetupComplete: stored.workspaceSetupComplete,
    displayName: stored.displayName || user.displayName,
    email: stored.email || user.email,
  };
}

/**
 * Upsert a federated / demo user into the tenant directory.
 * Signup without invite → workspace owner (root) with setup incomplete.
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
    existing.role = user.role;
    existing.lastLoginAt = now;
    existing.updatedAt = now;
    if (opts?.fromInvite) {
      existing.isWorkspaceOwner = false;
      existing.workspaceSetupComplete = true;
    }
    return existing;
  }

  const created: TenantUser = {
    id: user.id,
    tenantId: user.tenantId,
    email: normalizeEmail(user.email),
    displayName: user.displayName,
    role: user.role,
    linkedEmails: [],
    companyDomain: domainFromEmail(user.email),
    isWorkspaceOwner: opts?.isNewSignup === true && !opts?.fromInvite && user.role === 'root',
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
    // Keep invite-assigned role if already non-root; otherwise wait as contributor.
    if (stored.role === 'root') {
      stored.role = 'engineer';
    }
  } else {
    stored.isWorkspaceOwner = true;
    stored.role = 'root';
  }

  // Touch unused primary flag for audit metadata callers.
  void input.isPrimaryGoogleAccount;

  return authUserFromTenant(stored, actor.surface);
}

export function updateTenantUser(
  store: Store,
  actor: AuthUser,
  userId: string,
  input: UpdateTenantUserRequest,
): TenantUser {
  if (actor.role !== 'root' && actor.role !== 'manager') {
    throw Object.assign(new Error('requires role: root | manager'), { status: 403 });
  }
  const user = findTenantUser(store, userId, actor.tenantId);
  if (!user) {
    throw Object.assign(new Error('user not found'), { status: 404 });
  }
  if (input.role !== undefined) {
    if (!ALL_ROLES.includes(input.role)) {
      throw Object.assign(new Error('invalid role'), { status: 400 });
    }
    if (input.role === 'root' && actor.role !== 'root') {
      throw Object.assign(new Error('only root can assign root'), { status: 403 });
    }
    user.role = input.role;
    user.isWorkspaceOwner = input.role === 'root' ? user.isWorkspaceOwner : false;
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

export function createGroup(
  store: Store,
  actor: AuthUser,
  input: CreateIdentityGroupRequest,
): IdentityGroup {
  if (actor.role !== 'root' && actor.role !== 'manager') {
    throw Object.assign(new Error('requires role: root | manager'), { status: 403 });
  }
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
    roleIds: (input.roleIds ?? []).filter((r) => ALL_ROLES.includes(r)),
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
  if (actor.role !== 'root' && actor.role !== 'manager') {
    throw Object.assign(new Error('requires role: root | manager'), { status: 403 });
  }
  const group = listGroups(store, actor.tenantId).find((g) => g.id === groupId);
  if (!group) {
    throw Object.assign(new Error('group not found'), { status: 404 });
  }
  const now = new Date().toISOString();
  if (typeof input.name === 'string' && input.name.trim()) group.name = input.name.trim();
  if (typeof input.description === 'string') group.description = input.description.trim();
  if (input.roleIds) {
    group.roleIds = input.roleIds.filter((r) => ALL_ROLES.includes(r));
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
  if (actor.role !== 'root') {
    throw Object.assign(new Error('only root can delete groups'), { status: 403 });
  }
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

export function listConsoleServices(store: Store, tenantId = TENANT_ID): ConsoleServiceRecord[] {
  const connections = store.mcpConnectionsByTenant[tenantId] ?? [];
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
      connected: Boolean(conn),
      permissionLevel: conn?.permissionLevel ?? null,
      source: 'mcp' as const,
    };
  });
}

const IMPORT_SOURCES: IamImportSource[] = ['aws_iam', 'gcp_iam', 'csv', 'json'];

export function createIamImportJob(
  store: Store,
  actor: AuthUser,
  input: IamImportRequest,
): IamImportJob {
  if (actor.role !== 'root' && actor.role !== 'manager') {
    throw Object.assign(new Error('requires role: root | manager'), { status: 403 });
  }
  if (!IMPORT_SOURCES.includes(input.source)) {
    throw Object.assign(new Error('unsupported IAM import source'), { status: 400 });
  }

  const payload = (input.payload ?? '').trim();
  let mappedUsers = 0;
  let mappedGroups = 0;
  if (payload) {
    // Best-effort parse counts for the stub preview; never fails the request.
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
    summary:
      input.connectedCloudAccount
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
