/**
 * Workspace environments (Production / Staging / Development + custom).
 * MCP connections are scoped per environment; membership grants live in identity.
 */

import type {
  AuthUser,
  CreateEnvironmentRequest,
  EnsureEnvironmentsRequest,
  WorkspaceEnvironment,
  WorkspaceEnvironmentState,
} from '../../shared/types';
import {
  isWorkspaceOwnerUser,
  listGrantsForUser,
  userCanAccessEnvironment,
} from './identity';
import { nextId, TENANT_ID, type Store } from './store';

export const DEFAULT_ENVIRONMENT_DEFS: { key: string; name: string }[] = [
  { key: 'prod', name: 'Production' },
  { key: 'stage', name: 'Staging' },
  { key: 'dev', name: 'Development' },
];

function slugifyKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function tenantEnvs(store: Store, tenantId: string): WorkspaceEnvironment[] {
  if (!store.environmentsByTenant[tenantId]) {
    store.environmentsByTenant[tenantId] = [];
  }
  return store.environmentsByTenant[tenantId]!;
}

function stateFor(store: Store, tenantId: string): WorkspaceEnvironmentState {
  const environments = [...tenantEnvs(store, tenantId)].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  let activeEnvironmentId = store.activeEnvironmentByTenant[tenantId] ?? '';
  if (!environments.some((e) => e.id === activeEnvironmentId)) {
    activeEnvironmentId = environments[0]?.id ?? '';
    if (activeEnvironmentId) {
      store.activeEnvironmentByTenant[tenantId] = activeEnvironmentId;
    }
  }
  return { environments, activeEnvironmentId };
}

/** Seed default Prod/Stage/Dev when the tenant has none. */
export function ensureDefaultEnvironments(
  store: Store,
  tenantId = TENANT_ID,
  keys?: string[],
): WorkspaceEnvironmentState {
  const existing = tenantEnvs(store, tenantId);
  if (existing.length > 0) {
    return stateFor(store, tenantId);
  }

  const selectedKeys =
    keys && keys.length > 0
      ? keys.map(slugifyKey).filter(Boolean)
      : DEFAULT_ENVIRONMENT_DEFS.map((d) => d.key);

  if (selectedKeys.length === 0) {
    throw Object.assign(new Error('at least one environment key is required'), { status: 400 });
  }

  const now = new Date().toISOString();
  const byKey = new Map(DEFAULT_ENVIRONMENT_DEFS.map((d) => [d.key, d]));
  const created: WorkspaceEnvironment[] = [];
  for (const key of selectedKeys) {
    if (created.some((e) => e.key === key)) continue;
    const def = byKey.get(key);
    created.push({
      id: nextId('env'),
      tenantId,
      key,
      name: def?.name ?? key.charAt(0).toUpperCase() + key.slice(1),
      createdAt: now,
    });
  }
  store.environmentsByTenant[tenantId] = created;
  const preferred = created.find((e) => e.key === 'prod') ?? created[0]!;
  store.activeEnvironmentByTenant[tenantId] = preferred.id;
  return stateFor(store, tenantId);
}

export function listEnvironments(store: Store, tenantId = TENANT_ID): WorkspaceEnvironmentState {
  return ensureDefaultEnvironments(store, tenantId);
}

/** Resolve the active environment id, seeding defaults if needed. */
export function resolveActiveEnvironmentId(store: Store, tenantId: string): string {
  const state = ensureDefaultEnvironments(store, tenantId);
  return state.activeEnvironmentId;
}

/** Environments the actor may enter (owners: all). */
export function listEnvironmentsForUser(
  store: Store,
  actor: AuthUser,
): WorkspaceEnvironmentState {
  const full = ensureDefaultEnvironments(store, actor.tenantId);
  if (isWorkspaceOwnerUser(store, actor)) {
    return full;
  }
  const grantedIds = new Set(
    listGrantsForUser(store, actor.tenantId, actor.id).map((g) => g.environmentId),
  );
  const environments = full.environments.filter((e) => grantedIds.has(e.id));
  let activeEnvironmentId = full.activeEnvironmentId;
  if (!environments.some((e) => e.id === activeEnvironmentId)) {
    activeEnvironmentId = environments[0]?.id ?? '';
    if (activeEnvironmentId) {
      store.activeEnvironmentByTenant[actor.tenantId] = activeEnvironmentId;
    }
  }
  return { environments, activeEnvironmentId };
}

export function setActiveEnvironment(
  store: Store,
  tenantId: string,
  environmentId: string,
  actor?: AuthUser,
): WorkspaceEnvironmentState {
  ensureDefaultEnvironments(store, tenantId);
  const envs = tenantEnvs(store, tenantId);
  const found = envs.find((e) => e.id === environmentId);
  if (!found) {
    throw Object.assign(new Error('environment not found'), { status: 404 });
  }
  if (actor && !userCanAccessEnvironment(store, actor, environmentId)) {
    throw Object.assign(new Error('no access to this environment'), { status: 403 });
  }
  store.activeEnvironmentByTenant[tenantId] = found.id;
  return actor ? listEnvironmentsForUser(store, actor) : stateFor(store, tenantId);
}

export function createEnvironment(
  store: Store,
  tenantId: string,
  input: CreateEnvironmentRequest,
): { state: WorkspaceEnvironmentState; environment: WorkspaceEnvironment } {
  ensureDefaultEnvironments(store, tenantId);
  const key = slugifyKey(input.key || input.name);
  const name = input.name.trim();
  if (!key) {
    throw Object.assign(new Error('environment key is required'), { status: 400 });
  }
  if (!name) {
    throw Object.assign(new Error('environment name is required'), { status: 400 });
  }
  const envs = tenantEnvs(store, tenantId);
  if (envs.some((e) => e.key === key)) {
    throw Object.assign(new Error(`environment key "${key}" already exists`), { status: 409 });
  }
  const created: WorkspaceEnvironment = {
    id: nextId('env'),
    tenantId,
    key,
    name,
    createdAt: new Date().toISOString(),
  };
  envs.push(created);
  return { state: stateFor(store, tenantId), environment: created };
}

export function ensureEnvironmentsFromRequest(
  store: Store,
  tenantId: string,
  input: EnsureEnvironmentsRequest,
): WorkspaceEnvironmentState {
  const keys = Array.isArray(input.keys) ? input.keys.map(slugifyKey).filter(Boolean) : [];
  if (keys.length === 0) {
    throw Object.assign(new Error('body.keys must include at least one environment'), {
      status: 400,
    });
  }
  return ensureDefaultEnvironments(store, tenantId, keys);
}
