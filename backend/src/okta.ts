/**
 * Okta OIDC Authorization Code + PKCE for AplifyAI web.
 * Configure via OKTA_* env vars; when unset, status.enabled is false and routes 503.
 */

import { createHash, createPublicKey, randomBytes, verify as cryptoVerify } from 'node:crypto';
import type { AuthUser, UserRole } from '../../shared/types';
import { issueFederatedSession } from './auth';
import { TENANT_ID } from './store';

export type OktaIntent = 'login' | 'signup';

export interface OktaStatus {
  enabled: boolean;
  issuer?: string;
  clientId?: string;
  /** Where Okta will redirect after auth (must match Okta app config). */
  redirectUri?: string;
}

interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  issuer: string;
}

interface PendingAuth {
  codeVerifier: string;
  nonce: string;
  intent: OktaIntent;
  surface: 'web' | 'mobile';
  expiresAt: number;
}

interface PendingExchange {
  sessionToken: string;
  user: AuthUser;
  expiresAtIso: string;
  intent: OktaIntent;
  expiresAt: number;
}

const pendingByState = new Map<string, PendingAuth>();
const exchangeByCode = new Map<string, PendingExchange>();
const PENDING_TTL_MS = 10 * 60 * 1000;
const EXCHANGE_TTL_MS = 2 * 60 * 1000;

let discoveryCache: { at: number; doc: OidcDiscovery } | null = null;
let jwksCache: { at: number; keys: Jwk[] } | null = null;

interface Jwk {
  kty: string;
  kid?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
}

function trimEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

export function getOktaConfig(): {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  webAppOrigin: string;
  defaultRole: UserRole;
  groupRoleMap: Record<string, UserRole>;
} | null {
  const issuer = trimEnv('OKTA_ISSUER')?.replace(/\/$/, '');
  const clientId = trimEnv('OKTA_CLIENT_ID');
  const clientSecret = trimEnv('OKTA_CLIENT_SECRET');
  const redirectUri = trimEnv('OKTA_REDIRECT_URI');
  const webAppOrigin = trimEnv('WEB_APP_ORIGIN') ?? 'http://localhost:3000';
  if (!issuer || !clientId || !clientSecret || !redirectUri) return null;

  const defaultRole = parseRole(trimEnv('OKTA_DEFAULT_ROLE') ?? 'manager') ?? 'manager';
  let groupRoleMap: Record<string, UserRole> = {};
  const rawMap = trimEnv('OKTA_GROUP_ROLE_MAP');
  if (rawMap) {
    try {
      const parsed = JSON.parse(rawMap) as Record<string, string>;
      for (const [group, role] of Object.entries(parsed)) {
        const r = parseRole(role);
        if (r) groupRoleMap[group] = r;
      }
    } catch {
      groupRoleMap = {};
    }
  }

  return { issuer, clientId, clientSecret, redirectUri, webAppOrigin, defaultRole, groupRoleMap };
}

export function oktaStatus(): OktaStatus {
  const cfg = getOktaConfig();
  if (!cfg) return { enabled: false };
  return {
    enabled: true,
    issuer: cfg.issuer,
    clientId: cfg.clientId,
    redirectUri: cfg.redirectUri,
  };
}

function parseRole(value: string): UserRole | null {
  if (value === 'founder' || value === 'manager' || value === 'engineer' || value === 'auditor') {
    return value;
  }
  return null;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function sha256b64url(input: string): string {
  return createHash('sha256').update(input).digest('base64url');
}

function pruneMaps(now = Date.now()): void {
  for (const [k, v] of pendingByState) {
    if (v.expiresAt <= now) pendingByState.delete(k);
  }
  for (const [k, v] of exchangeByCode) {
    if (v.expiresAt <= now) exchangeByCode.delete(k);
  }
}

/** Test helper */
export function resetOktaPending(): void {
  pendingByState.clear();
  exchangeByCode.clear();
  discoveryCache = null;
  jwksCache = null;
}

async function discover(issuer: string): Promise<OidcDiscovery> {
  const now = Date.now();
  if (discoveryCache && now - discoveryCache.at < 60 * 60 * 1000 && discoveryCache.doc.issuer === issuer) {
    return discoveryCache.doc;
  }
  const res = await fetch(`${issuer}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`Okta discovery failed (${res.status})`);
  const doc = (await res.json()) as OidcDiscovery;
  if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.jwks_uri) {
    throw new Error('Okta discovery document incomplete');
  }
  discoveryCache = { at: now, doc };
  return doc;
}

async function getJwks(jwksUri: string): Promise<Jwk[]> {
  const now = Date.now();
  if (jwksCache && now - jwksCache.at < 60 * 60 * 1000) return jwksCache.keys;
  const res = await fetch(jwksUri);
  if (!res.ok) throw new Error(`Okta JWKS fetch failed (${res.status})`);
  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = body.keys ?? [];
  jwksCache = { at: now, keys };
  return keys;
}

function verifyRs256(idToken: string, jwk: Jwk): boolean {
  if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) return false;
  const [h, p, s] = idToken.split('.');
  if (!h || !p || !s) return false;
  const key = createPublicKey({
    key: { kty: 'RSA', n: jwk.n, e: jwk.e },
    format: 'jwk',
  });
  return cryptoVerify(
    'RSA-SHA256',
    Buffer.from(`${h}.${p}`),
    key,
    Buffer.from(s, 'base64url'),
  );
}

export async function verifyOktaIdToken(
  idToken: string,
  opts: { issuer: string; clientId: string; nonce: string; jwksUri: string },
): Promise<Record<string, unknown>> {
  const [h, p] = idToken.split('.');
  if (!h || !p) throw new Error('malformed id_token');
  const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8')) as { kid?: string; alg?: string };
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as Record<string, unknown>;
  if (header.alg !== 'RS256') throw new Error('unsupported id_token alg');
  const keys = await getJwks(opts.jwksUri);
  const jwk = keys.find((k) => k.kid === header.kid) ?? keys.find((k) => k.kty === 'RSA');
  if (!jwk || !verifyRs256(idToken, jwk)) throw new Error('id_token signature invalid');

  if (payload.iss !== opts.issuer) throw new Error('id_token iss mismatch');
  const aud = payload.aud;
  const audOk = aud === opts.clientId || (Array.isArray(aud) && aud.includes(opts.clientId));
  if (!audOk) throw new Error('id_token aud mismatch');
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
    throw new Error('id_token expired');
  }
  if (payload.nonce !== opts.nonce) throw new Error('id_token nonce mismatch');
  return payload;
}

export function mapOktaClaimsToUser(
  claims: Record<string, unknown>,
  cfg: NonNullable<ReturnType<typeof getOktaConfig>>,
  surface: 'web' | 'mobile',
): AuthUser {
  const sub = typeof claims.sub === 'string' ? claims.sub : null;
  const email =
    (typeof claims.email === 'string' && claims.email) ||
    (typeof claims.preferred_username === 'string' && claims.preferred_username) ||
    null;
  if (!sub || !email) throw new Error('Okta token missing sub/email');

  const displayName =
    (typeof claims.name === 'string' && claims.name) ||
    [claims.given_name, claims.family_name].filter((x) => typeof x === 'string').join(' ') ||
    email;

  let role = cfg.defaultRole;
  const groups = Array.isArray(claims.groups)
    ? claims.groups.filter((g): g is string => typeof g === 'string')
    : [];
  for (const group of groups) {
    const mapped = cfg.groupRoleMap[group];
    if (mapped) {
      role = mapped;
      break;
    }
  }
  const claimRole = parseRole(typeof claims.aplifyai_role === 'string' ? claims.aplifyai_role : '');
  if (claimRole) role = claimRole;

  // Signup intent callers may bump owner role — handled in route via intent.
  return {
    id: `okta:${sub}`,
    email,
    displayName,
    role,
    tenantId: TENANT_ID,
    surface,
  };
}

export async function buildOktaAuthorizeUrl(input: {
  intent: OktaIntent;
  surface: 'web' | 'mobile';
}): Promise<{ url: string; state: string }> {
  const cfg = getOktaConfig();
  if (!cfg) throw new Error('Okta is not configured');
  pruneMaps();
  const discovery = await discover(cfg.issuer);
  const state = b64url(randomBytes(24));
  const nonce = b64url(randomBytes(24));
  const codeVerifier = b64url(randomBytes(32));
  const codeChallenge = sha256b64url(codeVerifier);

  pendingByState.set(state, {
    codeVerifier,
    nonce,
    intent: input.intent,
    surface: input.surface,
    expiresAt: Date.now() + PENDING_TTL_MS,
  });

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    // Add "groups" in Okta authorization server claims + OKTA_AUTHORIZE_SCOPE if needed
    scope: trimEnv('OKTA_AUTHORIZE_SCOPE') ?? 'openid profile email',
    redirect_uri: cfg.redirectUri,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return { url: `${discovery.authorization_endpoint}?${params}`, state };
}

export async function completeOktaCallback(input: {
  code: string;
  state: string;
}): Promise<{ exchangeCode: string; intent: OktaIntent; webAppOrigin: string }> {
  const cfg = getOktaConfig();
  if (!cfg) throw new Error('Okta is not configured');
  pruneMaps();
  const pending = pendingByState.get(input.state);
  pendingByState.delete(input.state);
  if (!pending || pending.expiresAt <= Date.now()) {
    throw new Error('invalid or expired OAuth state');
  }

  const discovery = await discover(cfg.issuer);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code_verifier: pending.codeVerifier,
  });

  const tokenRes = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Okta token exchange failed (${tokenRes.status}): ${text.slice(0, 200)}`);
  }
  const tokenJson = (await tokenRes.json()) as { id_token?: string };
  if (!tokenJson.id_token) throw new Error('Okta response missing id_token');

  const claims = await verifyOktaIdToken(tokenJson.id_token, {
    issuer: cfg.issuer,
    clientId: cfg.clientId,
    nonce: pending.nonce,
    jwksUri: discovery.jwks_uri,
  });

  let user = mapOktaClaimsToUser(claims, cfg, pending.surface);
  // Creating a workspace via Okta signup → owner (founder) unless groups already mapped.
  if (pending.intent === 'signup' && Object.keys(cfg.groupRoleMap).length === 0) {
    user = { ...user, role: 'founder' };
  }

  const session = issueFederatedSession(user, 'okta');
  const exchangeCode = b64url(randomBytes(24));
  exchangeByCode.set(exchangeCode, {
    sessionToken: session.token,
    user: session.user,
    expiresAtIso: session.expiresAt,
    intent: pending.intent,
    expiresAt: Date.now() + EXCHANGE_TTL_MS,
  });

  return { exchangeCode, intent: pending.intent, webAppOrigin: cfg.webAppOrigin };
}

export function consumeOktaExchange(exchangeCode: string): {
  session: { token: string; user: AuthUser; expiresAt: string };
  intent: OktaIntent;
} | null {
  pruneMaps();
  const pending = exchangeByCode.get(exchangeCode);
  exchangeByCode.delete(exchangeCode);
  if (!pending || pending.expiresAt <= Date.now()) return null;
  return {
    session: {
      token: pending.sessionToken,
      user: pending.user,
      expiresAt: pending.expiresAtIso,
    },
    intent: pending.intent,
  };
}
