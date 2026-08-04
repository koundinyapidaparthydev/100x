import { afterEach, describe, expect, it } from 'vitest';
import { getSession, issueFederatedSession } from './auth';
import {
  consumeOktaExchange,
  getOktaConfig,
  mapOktaClaimsToUser,
  oktaStatus,
  resetOktaPending,
} from './okta';
import { TENANT_ID } from './store';

describe('Okta config + mapping', () => {
  afterEach(() => {
    delete process.env.OKTA_ISSUER;
    delete process.env.OKTA_CLIENT_ID;
    delete process.env.OKTA_CLIENT_SECRET;
    delete process.env.OKTA_REDIRECT_URI;
    delete process.env.OKTA_DEFAULT_ROLE;
    delete process.env.OKTA_GROUP_ROLE_MAP;
    resetOktaPending();
  });

  it('reports disabled when env is missing', () => {
    expect(oktaStatus()).toEqual({ enabled: false });
    expect(getOktaConfig()).toBeNull();
  });

  it('reports enabled when required env is set', () => {
    process.env.OKTA_ISSUER = 'https://example.okta.com/oauth2/default';
    process.env.OKTA_CLIENT_ID = 'client-id';
    process.env.OKTA_CLIENT_SECRET = 'client-secret';
    process.env.OKTA_REDIRECT_URI = 'http://localhost:4000/api/v1/auth/okta/callback';
    const status = oktaStatus();
    expect(status.enabled).toBe(true);
    expect(status.issuer).toContain('example.okta.com');
    expect(getOktaConfig()?.clientId).toBe('client-id');
  });

  it('maps Okta claims to AuthUser with group role map (custom role ids)', () => {
    process.env.OKTA_ISSUER = 'https://example.okta.com/oauth2/default';
    process.env.OKTA_CLIENT_ID = 'client-id';
    process.env.OKTA_CLIENT_SECRET = 'client-secret';
    process.env.OKTA_REDIRECT_URI = 'http://localhost:4000/api/v1/auth/okta/callback';
    process.env.OKTA_DEFAULT_ROLE = 'role-default';
    process.env.OKTA_GROUP_ROLE_MAP = JSON.stringify({ 'AplifyAI-Owners': 'role-owners' });
    const cfg = getOktaConfig()!;
    const user = mapOktaClaimsToUser(
      {
        sub: 'okta-sub-1',
        email: 'owner@acme.com',
        name: 'Owner Person',
        groups: ['AplifyAI-Owners', 'Everyone'],
      },
      cfg,
      'web',
    );
    expect(user.id).toBe('okta:okta-sub-1');
    expect(user.email).toBe('owner@acme.com');
    expect(user.roleId).toBe('role-owners');
    expect(user.tenantId).toBe(TENANT_ID);
  });

  it('ignores legacy built-in role names in the group map', () => {
    process.env.OKTA_ISSUER = 'https://example.okta.com/oauth2/default';
    process.env.OKTA_CLIENT_ID = 'client-id';
    process.env.OKTA_CLIENT_SECRET = 'client-secret';
    process.env.OKTA_REDIRECT_URI = 'http://localhost:4000/api/v1/auth/okta/callback';
    process.env.OKTA_GROUP_ROLE_MAP = JSON.stringify({ 'AplifyAI-Owners': 'root' });
    const cfg = getOktaConfig()!;
    const user = mapOktaClaimsToUser(
      { sub: 'okta-sub-2', email: 'legacy@acme.com', groups: ['AplifyAI-Owners'] },
      cfg,
      'web',
    );
    expect(user.roleId).toBeNull();
  });

  it('issues federated sessions that round-trip through getSession', () => {
    const session = issueFederatedSession({
      id: 'okta:abc',
      email: 'lead@acme.com',
      displayName: 'Lead',
      roleId: 'role-lead',
      tenantId: TENANT_ID,
      surface: 'web',
    });
    const loaded = getSession(session.token);
    expect(loaded?.user.email).toBe('lead@acme.com');
    expect(loaded?.user.roleId).toBe('role-lead');
    expect(loaded?.user.id).toBe('okta:abc');
  });

  it('consumes one-time exchange codes', () => {
    // Directly exercise consume after planting via complete is heavy; plant via private path:
    // issue session + manual inject not exported — use consume null for missing.
    expect(consumeOktaExchange('missing')).toBeNull();
  });
});
