import { afterEach, describe, expect, it } from 'vitest';
import { getSession, issueFederatedSession } from './auth';
import {
  allProvidersStatus,
  getProviderConfig,
  mapClaimsToUser,
  providerStatus,
  resetFederatedPending,
  consumeExchange,
  seedExchangeForTest,
} from './federatedOidc';
import { TENANT_ID } from './store';

describe('federated OIDC providers', () => {
  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (
        key.startsWith('OKTA_') ||
        key.startsWith('ENTRA_') ||
        key.startsWith('GOOGLE_') ||
        key.startsWith('APPLE_')
      ) {
        delete process.env[key];
      }
    }
    resetFederatedPending();
  });

  it('lists all providers as disabled without env', () => {
    const statuses = allProvidersStatus();
    expect(statuses).toHaveLength(5);
    expect(statuses.every((s) => s.enabled === false)).toBe(true);
  });

  it('enables Entra when required env is set', () => {
    process.env.ENTRA_CLIENT_ID = 'entra-client';
    process.env.ENTRA_CLIENT_SECRET = 'entra-secret';
    process.env.ENTRA_REDIRECT_URI = 'http://localhost:4000/api/v1/auth/entra/callback';
    process.env.ENTRA_TENANT_ID = 'contoso.onmicrosoft.com';
    const status = providerStatus('entra');
    expect(status.enabled).toBe(true);
    expect(status.label).toBe('Microsoft Entra ID');
    expect(status.category).toBe('enterprise_sso');
    expect(getProviderConfig('entra')?.issuer).toContain('login.microsoftonline.com');
  });

  it('enables Google social and Workspace with shared client credentials', () => {
    process.env.GOOGLE_CLIENT_ID = 'google-client';
    process.env.GOOGLE_CLIENT_SECRET = 'google-secret';
    process.env.GOOGLE_WORKSPACE_HD = 'acme.com';
    expect(providerStatus('google').enabled).toBe(true);
    expect(providerStatus('google_workspace').enabled).toBe(true);
    expect(getProviderConfig('google_workspace')?.authorizeExtras?.hd).toBe('acme.com');
  });

  it('requires Apple key material', () => {
    process.env.APPLE_CLIENT_ID = 'com.example.service';
    expect(providerStatus('apple').enabled).toBe(false);
    process.env.APPLE_TEAM_ID = 'TEAM123';
    process.env.APPLE_KEY_ID = 'KEY123';
    process.env.APPLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMII\n-----END PRIVATE KEY-----';
    expect(providerStatus('apple').enabled).toBe(true);
    expect(providerStatus('apple').category).toBe('social');
  });

  it('maps Entra claims with group role map', () => {
    process.env.ENTRA_CLIENT_ID = 'entra-client';
    process.env.ENTRA_CLIENT_SECRET = 'entra-secret';
    process.env.ENTRA_REDIRECT_URI = 'http://localhost:4000/api/v1/auth/entra/callback';
    process.env.ENTRA_DEFAULT_ROLE = 'role-default';
    process.env.ENTRA_GROUP_ROLE_MAP = JSON.stringify({ '100x-Owners': 'role-owners' });
    const cfg = getProviderConfig('entra')!;
    const user = mapClaimsToUser(
      {
        sub: 'entra-sub-1',
        email: 'owner@contoso.com',
        name: 'Owner Person',
        groups: ['100x-Owners'],
      },
      cfg,
      'web',
    );
    expect(user.id).toBe('entra:entra-sub-1');
    expect(user.roleId).toBe('role-owners');
    expect(user.tenantId).toBe(TENANT_ID);
  });

  it('rejects Google Workspace accounts outside hosted domain', () => {
    process.env.GOOGLE_WORKSPACE_CLIENT_ID = 'gw-client';
    process.env.GOOGLE_WORKSPACE_CLIENT_SECRET = 'gw-secret';
    process.env.GOOGLE_WORKSPACE_HD = 'acme.com';
    const cfg = getProviderConfig('google_workspace')!;
    expect(() =>
      mapClaimsToUser(
        { sub: 'g1', email: 'x@other.com', hd: 'other.com' },
        cfg,
        'mobile',
      ),
    ).toThrow(/acme.com/);
  });

  it('allows Apple users without email claim', () => {
    process.env.APPLE_CLIENT_ID = 'com.example.service';
    process.env.APPLE_TEAM_ID = 'TEAM123';
    process.env.APPLE_KEY_ID = 'KEY123';
    process.env.APPLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMII\n-----END PRIVATE KEY-----';
    const cfg = getProviderConfig('apple')!;
    const user = mapClaimsToUser({ sub: 'apple-sub' }, cfg, 'mobile');
    expect(user.id).toBe('apple:apple-sub');
    expect(user.email).toContain('apple-apple-sub@');
  });

  it('issues federated sessions for non-Okta providers', () => {
    const session = issueFederatedSession(
      {
        id: 'google:abc',
        email: 'lead@gmail.com',
        displayName: 'Lead',
        roleId: null,
        tenantId: TENANT_ID,
        surface: 'mobile',
      },
      'google',
    );
    const loaded = getSession(session.token);
    expect(loaded?.user.email).toBe('lead@gmail.com');
    expect(loaded?.user.id).toBe('google:abc');
  });

  it('returns null for missing exchange codes', () => {
    expect(consumeExchange('missing')).toBeNull();
  });

  it('replays a consumed exchange code briefly (Strict Mode / double submit)', () => {
    const session = issueFederatedSession(
      {
        id: 'google:replay',
        email: 'replay@gmail.com',
        displayName: 'Replay',
        roleId: null,
        tenantId: TENANT_ID,
        surface: 'web',
      },
      'google',
    );
    seedExchangeForTest({
      code: 'test-exchange-replay',
      provider: 'google',
      sessionToken: session.token,
      user: session.user,
      expiresAtIso: session.expiresAt,
    });
    const first = consumeExchange('test-exchange-replay');
    const second = consumeExchange('test-exchange-replay');
    expect(first?.session.token).toBe(session.token);
    expect(second?.session.token).toBe(session.token);
    expect(second?.provider).toBe('google');
  });
});
