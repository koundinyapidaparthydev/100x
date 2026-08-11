import { describe, expect, it } from 'vitest';
import { effectivePolicy, ensureEnvPolicies, orgBasePolicy } from './policyResolve';
import { createSeedStore, ORG_POLICY_ID } from './store';

describe('policyResolve', () => {
  it('seeds org base + per-env rows and merges effective policy', () => {
    const store = createSeedStore();
    expect(orgBasePolicy(store)?.id).toBe(ORG_POLICY_ID);
    expect(store.policies.filter((p) => p.environmentId != null)).toHaveLength(3);

    const stage = store.policies.find((p) => p.environmentId === 'env-stage')!;
    stage.pii.email = { mode: 'hash' };
    store.policies.find((p) => p.id === ORG_POLICY_ID)!.tokenBudget.maxTotalTokens = 12_000;

    const effective = effectivePolicy(store, 'env-stage')!;
    expect(effective.pii.email.mode).toBe('hash');
    expect(effective.tokenBudget.maxTotalTokens).toBe(12_000);
    expect(effectivePolicy(store, 'env-prod')!.pii.email.mode).not.toBe('hash');
  });

  it('clones missing env policies from prod/org on ensure', () => {
    const store = createSeedStore();
    store.policies = store.policies.filter((p) => p.environmentId == null);
    expect(store.policies).toHaveLength(1);
    ensureEnvPolicies(store);
    expect(store.policies.filter((p) => p.environmentId != null)).toHaveLength(3);
  });
});
