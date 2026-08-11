/**
 * Org base + per-environment policy merge.
 *
 * Org-wide: securityLevel, tokenBudget, aiFirstDefault, targetCompletionPercentDefault, locks
 * Per env:  pii, customerNames, cloud, model, platform, mcpAllowlist
 */

import type { Policy } from '../../shared/types';
import { nextId, ORG_POLICY_ID, type Store, TENANT_ID } from './store';

// Policy is mutated in-place when normalizing legacy snapshots.

export const ORG_ONLY_POLICY_FIELDS = [
  'securityLevel',
  'tokenBudget',
  'aiFirstDefault',
  'targetCompletionPercentDefault',
  'locks',
] as const;

export const ENV_ONLY_POLICY_FIELDS = [
  'pii',
  'customerNames',
  'cloud',
  'model',
  'platform',
  'mcpAllowlist',
] as const;

export type OrgOnlyPolicyField = (typeof ORG_ONLY_POLICY_FIELDS)[number];
export type EnvOnlyPolicyField = (typeof ENV_ONLY_POLICY_FIELDS)[number];

export function isOrgBasePolicy(policy: Policy): boolean {
  return policy.environmentId == null;
}

export function orgBasePolicy(store: Store, tenantId = TENANT_ID): Policy | undefined {
  return (
    store.policies.find((p) => p.tenantId === tenantId && p.id === ORG_POLICY_ID) ??
    store.policies.find((p) => p.tenantId === tenantId && p.environmentId == null)
  );
}

export function envPolicyRow(
  store: Store,
  environmentId: string,
  tenantId = TENANT_ID,
): Policy | undefined {
  return store.policies.find(
    (p) => p.tenantId === tenantId && p.environmentId === environmentId,
  );
}

/** Clone per-env fields (and placeholder org fields) for a new environment row. */
export function clonePolicyForEnvironment(
  source: Policy,
  environmentId: string,
  id = nextId('pol'),
): Policy {
  return {
    ...structuredClone(source),
    id,
    environmentId,
    scope: 'org',
  };
}

/**
 * Ensure every workspace environment has a policy row.
 * Missing rows are cloned from the prod env policy, else the org base.
 */
export function ensureEnvPolicies(store: Store, tenantId = TENANT_ID): void {
  const org = orgBasePolicy(store, tenantId);
  if (!org) return;

  // Normalize legacy rows missing environmentId onto org base.
  for (const policy of store.policies) {
    if (policy.tenantId !== tenantId) continue;
    if (policy.environmentId === undefined) {
      (policy as Policy).environmentId = null;
    }
  }
  if (org.environmentId !== null) org.environmentId = null;

  const envs = store.environmentsByTenant[tenantId] ?? [];
  if (envs.length === 0) return;

  const prodEnv = envs.find((e) => e.key === 'prod');
  const prodPolicy = prodEnv ? envPolicyRow(store, prodEnv.id, tenantId) : undefined;
  const cloneSource = prodPolicy ?? org;

  for (const env of envs) {
    if (envPolicyRow(store, env.id, tenantId)) continue;
    store.policies.push(clonePolicyForEnvironment(cloneSource, env.id));
  }
}

/**
 * Full policy for runtime: org-wide knobs from base + per-env fields from the env row.
 * Creates missing env rows when needed.
 */
export function effectivePolicy(
  store: Store,
  environmentId: string,
  tenantId = TENANT_ID,
): Policy | undefined {
  ensureEnvPolicies(store, tenantId);
  const org = orgBasePolicy(store, tenantId);
  const env = envPolicyRow(store, environmentId, tenantId);
  if (!org) return env;
  if (!env) return { ...org, environmentId };

  return {
    ...org,
    id: env.id,
    environmentId,
    pii: env.pii,
    customerNames: env.customerNames,
    cloud: env.cloud,
    model: env.model,
    platform: env.platform,
    mcpAllowlist: env.mcpAllowlist,
  };
}
