/**
 * Multi-provider OIDC Authorization Code + PKCE for AplifyAI.
 * Providers: Okta, Microsoft Entra ID, Google Workspace, Google, Apple.
 * Configure via per-provider env vars; when unset, status.enabled is false.
 */

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  createSign,
  randomBytes,
  verify as cryptoVerify,
} from 'node:crypto';
import type { AuthUser, FederatedAuthProvider, UserRole } from '../../shared/types';
import { issueFederatedSession } from './auth';
import { TENANT_ID } from './store';

export type AuthIntent = 'login' | 'signup';
export type AuthSurface = 'web' | 'mobile';

export const FEDERATED_PROVIDERS: FederatedAuthProvider[] = [
  'okta',
  'entra',
  'google_workspace',
  'google',
  'apple',
];

export interface FederatedProviderStatus {
  enabled: boolean;
  provider: FederatedAuthProvider;
  label: string;
  category: 'enterprise_sso' | 'social';
  issuer?: string;
  clientId?: string;
  redirectUri?: string;
}

interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  issuer: string;
}

interface ProviderRuntimeConfig {
  provider: FederatedAuthProvider;
  label: string;
  category: 'enterprise_sso' | 'social';
  issuer: string;
  clientId: string;
  /** Static secret, or dynamically minted (Apple). */
  resolveClientSecret: () => string;
  redirectUri: string;
  webAppOrigin: string;
  mobileAppOrigin: string;
  defaultRole: UserRole;
  groupRoleMap: Record<string, UserRole>;
  scope: string;
  /** Extra authorize query params (e.g. Google hd=). */
  authorizeExtras?: Record<string, string>;
  /** Token endpoint auth style. */
  tokenAuth: 'client_secret_post' | 'none';
  /** Apple returns email only on first consent; allow missing email with fallback. */
  allowMissingEmail?: boolean;
  /** Skip standard discovery and use fixed endpoints. */
  fixedDiscovery?: OidcDiscovery;
}

interface PendingAuth {
  provider: FederatedAuthProvider;
  codeVerifier: string;
  nonce: string;
  intent: AuthIntent;
  surface: AuthSurface;
  expiresAt: number;
}

interface PendingExchange {
  provider: FederatedAuthProvider;
  sessionToken: string;
  user: AuthUser;
  expiresAtIso: string;
  intent: AuthIntent;
  expiresAt: number;
}

interface Jwk {
  kty: string;
  kid?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
}

type ConsumedExchange = {
  session: { token: string; user: AuthUser; expiresAt: string };
  intent: AuthIntent;
  provider: FederatedAuthProvider;
  expiresAt: number;
};

const pendingByState = new Map<string, PendingAuth>();
const exchangeByCode = new Map<string, PendingExchange>();
/** Allows React Strict Mode / double-submit to redeem the same code briefly. */
const consumedExchangeByCode = new Map<string, ConsumedExchange>();
const PENDING_TTL_MS = 10 * 60 * 1000;
const EXCHANGE_TTL_MS = 2 * 60 * 1000;
const CONSUMED_REPLAY_TTL_MS = 60 * 1000;

const discoveryCache = new Map<string, { at: number; doc: OidcDiscovery }>();
const jwksCache = new Map<string, { at: number; keys: Jwk[] }>();

function trimEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

function parseRole(value: string): UserRole | null {
  if (value === 'founder' || value === 'manager' || value === 'engineer' || value === 'auditor') {
    return value;
  }
  return null;
}

function parseGroupRoleMap(raw: string | undefined): Record<string, UserRole> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, UserRole> = {};
    for (const [group, role] of Object.entries(parsed)) {
      const r = parseRole(role);
      if (r) out[group] = r;
    }
    return out;
  } catch {
    return {};
  }
}

function b64url(buf: Buffer | string): string {
  return Buffer.isBuffer(buf) ? buf.toString('base64url') : Buffer.from(buf).toString('base64url');
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
  for (const [k, v] of consumedExchangeByCode) {
    if (v.expiresAt <= now) consumedExchangeByCode.delete(k);
  }
}

/** Test helper */
export function resetFederatedPending(): void {
  pendingByState.clear();
  exchangeByCode.clear();
  consumedExchangeByCode.clear();
  discoveryCache.clear();
  jwksCache.clear();
}

/** Test helper — plant a one-time exchange code. */
export function seedExchangeForTest(input: {
  code: string;
  provider: FederatedAuthProvider;
  sessionToken: string;
  user: AuthUser;
  expiresAtIso: string;
  intent?: AuthIntent;
}): void {
  exchangeByCode.set(input.code, {
    provider: input.provider,
    sessionToken: input.sessionToken,
    user: input.user,
    expiresAtIso: input.expiresAtIso,
    intent: input.intent ?? 'login',
    expiresAt: Date.now() + EXCHANGE_TTL_MS,
  });
}

function webOrigin(): string {
  return trimEnv('WEB_APP_ORIGIN') ?? 'http://localhost:3000';
}

function mobileOrigin(): string {
  return trimEnv('MOBILE_APP_ORIGIN') ?? 'aplifyai://auth';
}

function appleClientSecret(clientId: string): string {
  const teamId = trimEnv('APPLE_TEAM_ID');
  const keyId = trimEnv('APPLE_KEY_ID');
  const privateKeyRaw = trimEnv('APPLE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
  if (!teamId || !keyId || !privateKeyRaw) {
    throw new Error('Apple Sign In is missing APPLE_TEAM_ID, APPLE_KEY_ID, or APPLE_PRIVATE_KEY');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: keyId };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 60 * 60 * 24 * 150,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = createPrivateKey(privateKeyRaw);
  const signer = createSign('SHA256');
  signer.update(unsigned);
  signer.end();
  // Apple expects IEEE-P1363 (r||s) ECDSA, not DER — Node's dsaEncoding: 'ieee-p1363'
  const sig = signer.sign({ key, dsaEncoding: 'ieee-p1363' });
  return `${unsigned}.${sig.toString('base64url')}`;
}

function loadProviderConfig(provider: FederatedAuthProvider): ProviderRuntimeConfig | null {
  switch (provider) {
    case 'okta': {
      const issuer = trimEnv('OKTA_ISSUER')?.replace(/\/$/, '');
      const clientId = trimEnv('OKTA_CLIENT_ID');
      const clientSecret = trimEnv('OKTA_CLIENT_SECRET');
      const redirectUri = trimEnv('OKTA_REDIRECT_URI');
      if (!issuer || !clientId || !clientSecret || !redirectUri) return null;
      return {
        provider,
        label: 'Okta',
        category: 'enterprise_sso',
        issuer,
        clientId,
        resolveClientSecret: () => clientSecret,
        redirectUri,
        webAppOrigin: webOrigin(),
        mobileAppOrigin: mobileOrigin(),
        defaultRole: parseRole(trimEnv('OKTA_DEFAULT_ROLE') ?? 'manager') ?? 'manager',
        groupRoleMap: parseGroupRoleMap(trimEnv('OKTA_GROUP_ROLE_MAP')),
        scope: trimEnv('OKTA_AUTHORIZE_SCOPE') ?? 'openid profile email',
        tokenAuth: 'client_secret_post',
      };
    }
    case 'entra': {
      const tenant = trimEnv('ENTRA_TENANT_ID') ?? 'common';
      const issuer =
        trimEnv('ENTRA_ISSUER')?.replace(/\/$/, '') ??
        `https://login.microsoftonline.com/${tenant}/v2.0`;
      const clientId = trimEnv('ENTRA_CLIENT_ID');
      const clientSecret = trimEnv('ENTRA_CLIENT_SECRET');
      const redirectUri = trimEnv('ENTRA_REDIRECT_URI');
      if (!clientId || !clientSecret || !redirectUri) return null;
      return {
        provider,
        label: 'Microsoft Entra ID',
        category: 'enterprise_sso',
        issuer,
        clientId,
        resolveClientSecret: () => clientSecret,
        redirectUri,
        webAppOrigin: webOrigin(),
        mobileAppOrigin: mobileOrigin(),
        defaultRole: parseRole(trimEnv('ENTRA_DEFAULT_ROLE') ?? 'manager') ?? 'manager',
        groupRoleMap: parseGroupRoleMap(trimEnv('ENTRA_GROUP_ROLE_MAP')),
        scope: trimEnv('ENTRA_AUTHORIZE_SCOPE') ?? 'openid profile email',
        tokenAuth: 'client_secret_post',
      };
    }
    case 'google_workspace': {
      const issuer = (trimEnv('GOOGLE_WORKSPACE_ISSUER') ?? 'https://accounts.google.com').replace(
        /\/$/,
        '',
      );
      const clientId = trimEnv('GOOGLE_WORKSPACE_CLIENT_ID') ?? trimEnv('GOOGLE_CLIENT_ID');
      const clientSecret =
        trimEnv('GOOGLE_WORKSPACE_CLIENT_SECRET') ?? trimEnv('GOOGLE_CLIENT_SECRET');
      const redirectUri =
        trimEnv('GOOGLE_WORKSPACE_REDIRECT_URI') ??
        'http://localhost:4000/api/v1/auth/google_workspace/callback';
      const hd = trimEnv('GOOGLE_WORKSPACE_HD');
      if (!clientId || !clientSecret) return null;
      return {
        provider,
        label: 'Google Workspace',
        category: 'enterprise_sso',
        issuer,
        clientId,
        resolveClientSecret: () => clientSecret,
        redirectUri,
        webAppOrigin: webOrigin(),
        mobileAppOrigin: mobileOrigin(),
        defaultRole: parseRole(trimEnv('GOOGLE_WORKSPACE_DEFAULT_ROLE') ?? 'manager') ?? 'manager',
        groupRoleMap: parseGroupRoleMap(trimEnv('GOOGLE_WORKSPACE_GROUP_ROLE_MAP')),
        scope: trimEnv('GOOGLE_WORKSPACE_AUTHORIZE_SCOPE') ?? 'openid profile email',
        authorizeExtras: hd ? { hd, prompt: 'select_account' } : { prompt: 'select_account' },
        tokenAuth: 'client_secret_post',
      };
    }
    case 'google': {
      const issuer = (trimEnv('GOOGLE_ISSUER') ?? 'https://accounts.google.com').replace(/\/$/, '');
      const clientId = trimEnv('GOOGLE_CLIENT_ID');
      const clientSecret = trimEnv('GOOGLE_CLIENT_SECRET');
      const redirectUri =
        trimEnv('GOOGLE_REDIRECT_URI') ?? 'http://localhost:4000/api/v1/auth/google/callback';
      if (!clientId || !clientSecret) return null;
      return {
        provider,
        label: 'Google',
        category: 'social',
        issuer,
        clientId,
        resolveClientSecret: () => clientSecret,
        redirectUri,
        webAppOrigin: webOrigin(),
        mobileAppOrigin: mobileOrigin(),
        defaultRole: parseRole(trimEnv('GOOGLE_DEFAULT_ROLE') ?? 'manager') ?? 'manager',
        groupRoleMap: {},
        scope: trimEnv('GOOGLE_AUTHORIZE_SCOPE') ?? 'openid profile email',
        authorizeExtras: { prompt: 'select_account' },
        tokenAuth: 'client_secret_post',
      };
    }
    case 'apple': {
      const issuer = (trimEnv('APPLE_ISSUER') ?? 'https://appleid.apple.com').replace(/\/$/, '');
      const clientId = trimEnv('APPLE_CLIENT_ID');
      const redirectUri =
        trimEnv('APPLE_REDIRECT_URI') ?? 'http://localhost:4000/api/v1/auth/apple/callback';
      const teamId = trimEnv('APPLE_TEAM_ID');
      const keyId = trimEnv('APPLE_KEY_ID');
      const privateKey = trimEnv('APPLE_PRIVATE_KEY');
      if (!clientId || !teamId || !keyId || !privateKey) return null;
      return {
        provider,
        label: 'Apple',
        category: 'social',
        issuer,
        clientId,
        resolveClientSecret: () => appleClientSecret(clientId),
        redirectUri,
        webAppOrigin: webOrigin(),
        mobileAppOrigin: mobileOrigin(),
        defaultRole: parseRole(trimEnv('APPLE_DEFAULT_ROLE') ?? 'manager') ?? 'manager',
        groupRoleMap: {},
        scope: trimEnv('APPLE_AUTHORIZE_SCOPE') ?? 'openid name email',
        authorizeExtras: { response_mode: 'query' },
        tokenAuth: 'client_secret_post',
        allowMissingEmail: true,
        fixedDiscovery: {
          issuer,
          authorization_endpoint: 'https://appleid.apple.com/auth/authorize',
          token_endpoint: 'https://appleid.apple.com/auth/token',
          jwks_uri: 'https://appleid.apple.com/auth/keys',
        },
      };
    }
    default:
      return null;
  }
}

export function isFederatedProvider(value: string): value is FederatedAuthProvider {
  return (FEDERATED_PROVIDERS as string[]).includes(value);
}

export function getProviderConfig(provider: FederatedAuthProvider): ProviderRuntimeConfig | null {
  return loadProviderConfig(provider);
}

export function providerStatus(provider: FederatedAuthProvider): FederatedProviderStatus {
  const cfg = loadProviderConfig(provider);
  const labels: Record<FederatedAuthProvider, { label: string; category: 'enterprise_sso' | 'social' }> =
    {
      okta: { label: 'Okta', category: 'enterprise_sso' },
      entra: { label: 'Microsoft Entra ID', category: 'enterprise_sso' },
      google_workspace: { label: 'Google Workspace', category: 'enterprise_sso' },
      google: { label: 'Google', category: 'social' },
      apple: { label: 'Apple', category: 'social' },
    };
  if (!cfg) {
    return { enabled: false, provider, ...labels[provider] };
  }
  return {
    enabled: true,
    provider,
    label: cfg.label,
    category: cfg.category,
    issuer: cfg.issuer,
    clientId: cfg.clientId,
    redirectUri: cfg.redirectUri,
  };
}

export function allProvidersStatus(): FederatedProviderStatus[] {
  return FEDERATED_PROVIDERS.map((p) => providerStatus(p));
}

async function discover(cfg: ProviderRuntimeConfig): Promise<OidcDiscovery> {
  if (cfg.fixedDiscovery) return cfg.fixedDiscovery;
  const now = Date.now();
  const cached = discoveryCache.get(cfg.issuer);
  if (cached && now - cached.at < 60 * 60 * 1000) return cached.doc;
  const res = await fetch(`${cfg.issuer}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`${cfg.label} discovery failed (${res.status})`);
  const doc = (await res.json()) as OidcDiscovery;
  if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.jwks_uri) {
    throw new Error(`${cfg.label} discovery document incomplete`);
  }
  // Entra discovery issuer may include tenant GUID; accept configured issuer family.
  discoveryCache.set(cfg.issuer, { at: now, doc });
  return doc;
}

async function getJwks(jwksUri: string): Promise<Jwk[]> {
  const now = Date.now();
  const cached = jwksCache.get(jwksUri);
  if (cached && now - cached.at < 60 * 60 * 1000) return cached.keys;
  const res = await fetch(jwksUri);
  if (!res.ok) throw new Error(`JWKS fetch failed (${res.status})`);
  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = body.keys ?? [];
  jwksCache.set(jwksUri, { at: now, keys });
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

export async function verifyIdToken(
  idToken: string,
  opts: { issuer: string; clientId: string; nonce: string; jwksUri: string; label: string },
): Promise<Record<string, unknown>> {
  const [h, p] = idToken.split('.');
  if (!h || !p) throw new Error('malformed id_token');
  const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8')) as {
    kid?: string;
    alg?: string;
  };
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as Record<string, unknown>;
  if (header.alg !== 'RS256') throw new Error('unsupported id_token alg');
  const keys = await getJwks(opts.jwksUri);
  const jwk = keys.find((k) => k.kid === header.kid) ?? keys.find((k) => k.kty === 'RSA');
  if (!jwk || !verifyRs256(idToken, jwk)) throw new Error('id_token signature invalid');

  const iss = typeof payload.iss === 'string' ? payload.iss.replace(/\/$/, '') : '';
  const expectedIss = opts.issuer.replace(/\/$/, '');
  // Entra may return issuer with concrete tenant id even when configured with /common
  const issOk =
    iss === expectedIss ||
    (expectedIss.includes('/common/') && iss.startsWith('https://login.microsoftonline.com/')) ||
    (expectedIss.includes('/organizations/') &&
      iss.startsWith('https://login.microsoftonline.com/'));
  if (!issOk) throw new Error('id_token iss mismatch');

  const aud = payload.aud;
  const audOk = aud === opts.clientId || (Array.isArray(aud) && aud.includes(opts.clientId));
  if (!audOk) throw new Error('id_token aud mismatch');
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
    throw new Error('id_token expired');
  }
  if (payload.nonce !== opts.nonce) throw new Error('id_token nonce mismatch');
  return payload;
}

function extractGroups(claims: Record<string, unknown>): string[] {
  const groups = Array.isArray(claims.groups)
    ? claims.groups.filter((g): g is string => typeof g === 'string')
    : [];
  const roles = Array.isArray(claims.roles)
    ? claims.roles.filter((g): g is string => typeof g === 'string')
    : [];
  return [...groups, ...roles];
}

export function mapClaimsToUser(
  claims: Record<string, unknown>,
  cfg: ProviderRuntimeConfig,
  surface: AuthSurface,
): AuthUser {
  const sub = typeof claims.sub === 'string' ? claims.sub : null;
  const email =
    (typeof claims.email === 'string' && claims.email) ||
    (typeof claims.preferred_username === 'string' && claims.preferred_username) ||
    (typeof claims.upn === 'string' && claims.upn) ||
    null;

  if (!sub) throw new Error(`${cfg.label} token missing sub`);
  if (!email && !cfg.allowMissingEmail) {
    throw new Error(`${cfg.label} token missing email`);
  }

  const resolvedEmail = email ?? `${cfg.provider}-${sub}@users.aplifyai.local`;

  const displayName =
    (typeof claims.name === 'string' && claims.name) ||
    [claims.given_name, claims.family_name].filter((x) => typeof x === 'string').join(' ') ||
    // Apple may nest name only on first authorization in the form POST user field — id_token often has none
    resolvedEmail;

  let role = cfg.defaultRole;
  for (const group of extractGroups(claims)) {
    const mapped = cfg.groupRoleMap[group];
    if (mapped) {
      role = mapped;
      break;
    }
  }
  const claimRole = parseRole(typeof claims.aplifyai_role === 'string' ? claims.aplifyai_role : '');
  if (claimRole) role = claimRole;

  // Google Workspace hosted-domain soft check when hd claim present
  if (cfg.provider === 'google_workspace' && cfg.authorizeExtras?.hd) {
    const hd = typeof claims.hd === 'string' ? claims.hd : '';
    if (hd && hd.toLowerCase() !== cfg.authorizeExtras.hd.toLowerCase()) {
      throw new Error(`Google account must belong to ${cfg.authorizeExtras.hd}`);
    }
  }

  return {
    id: `${cfg.provider}:${sub}`,
    email: resolvedEmail,
    displayName,
    role,
    tenantId: TENANT_ID,
    surface,
  };
}

export async function buildAuthorizeUrl(
  provider: FederatedAuthProvider,
  input: { intent: AuthIntent; surface: AuthSurface },
): Promise<{ url: string; state: string }> {
  const cfg = loadProviderConfig(provider);
  if (!cfg) throw new Error(`${provider} is not configured`);
  pruneMaps();
  const discovery = await discover(cfg);
  const state = b64url(randomBytes(24));
  const nonce = b64url(randomBytes(24));
  const codeVerifier = b64url(randomBytes(32));
  const codeChallenge = sha256b64url(codeVerifier);

  pendingByState.set(state, {
    provider,
    codeVerifier,
    nonce,
    intent: input.intent,
    surface: input.surface,
    expiresAt: Date.now() + PENDING_TTL_MS,
  });

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    scope: cfg.scope,
    redirect_uri: cfg.redirectUri,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    ...cfg.authorizeExtras,
  });

  return { url: `${discovery.authorization_endpoint}?${params}`, state };
}

export async function completeCallback(
  provider: FederatedAuthProvider,
  input: { code: string; state: string },
): Promise<{
  exchangeCode: string;
  intent: AuthIntent;
  surface: AuthSurface;
  webAppOrigin: string;
  mobileAppOrigin: string;
  provider: FederatedAuthProvider;
}> {
  const cfg = loadProviderConfig(provider);
  if (!cfg) throw new Error(`${provider} is not configured`);
  pruneMaps();
  const pending = pendingByState.get(input.state);
  pendingByState.delete(input.state);
  if (!pending || pending.expiresAt <= Date.now() || pending.provider !== provider) {
    throw new Error('invalid or expired OAuth state');
  }

  const discovery = await discover(cfg);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId,
    code_verifier: pending.codeVerifier,
  });
  if (cfg.tokenAuth === 'client_secret_post') {
    body.set('client_secret', cfg.resolveClientSecret());
  }

  const tokenRes = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`${cfg.label} token exchange failed (${tokenRes.status}): ${text.slice(0, 200)}`);
  }
  const tokenJson = (await tokenRes.json()) as { id_token?: string };
  if (!tokenJson.id_token) throw new Error(`${cfg.label} response missing id_token`);

  const claims = await verifyIdToken(tokenJson.id_token, {
    issuer: discovery.issuer || cfg.issuer,
    clientId: cfg.clientId,
    nonce: pending.nonce,
    jwksUri: discovery.jwks_uri,
    label: cfg.label,
  });

  let user = mapClaimsToUser(claims, cfg, pending.surface);
  if (pending.intent === 'signup' && Object.keys(cfg.groupRoleMap).length === 0) {
    user = { ...user, role: 'founder' };
  }

  const session = issueFederatedSession(user, provider);
  const exchangeCode = b64url(randomBytes(24));
  exchangeByCode.set(exchangeCode, {
    provider,
    sessionToken: session.token,
    user: session.user,
    expiresAtIso: session.expiresAt,
    intent: pending.intent,
    expiresAt: Date.now() + EXCHANGE_TTL_MS,
  });

  return {
    exchangeCode,
    intent: pending.intent,
    surface: pending.surface,
    webAppOrigin: cfg.webAppOrigin,
    mobileAppOrigin: cfg.mobileAppOrigin,
    provider,
  };
}

export function consumeExchange(exchangeCode: string): {
  session: { token: string; user: AuthUser; expiresAt: string };
  intent: AuthIntent;
  provider: FederatedAuthProvider;
} | null {
  pruneMaps();
  const replay = consumedExchangeByCode.get(exchangeCode);
  if (replay && replay.expiresAt > Date.now()) {
    return {
      session: replay.session,
      intent: replay.intent,
      provider: replay.provider,
    };
  }

  const pending = exchangeByCode.get(exchangeCode);
  exchangeByCode.delete(exchangeCode);
  if (!pending || pending.expiresAt <= Date.now()) return null;
  const result = {
    session: {
      token: pending.sessionToken,
      user: pending.user,
      expiresAt: pending.expiresAtIso,
    },
    intent: pending.intent,
    provider: pending.provider,
  };
  consumedExchangeByCode.set(exchangeCode, {
    ...result,
    expiresAt: Date.now() + CONSUMED_REPLAY_TTL_MS,
  });
  return result;
}

/** Build post-login redirect for web or mobile deep link. */
export function clientCallbackUrl(input: {
  surface: AuthSurface;
  webAppOrigin: string;
  mobileAppOrigin: string;
  exchangeCode: string;
  intent: AuthIntent;
  provider: FederatedAuthProvider;
}): string {
  const qs = new URLSearchParams({
    exchange: input.exchangeCode,
    intent: input.intent,
    provider: input.provider,
  });
  if (input.surface === 'mobile') {
    // Custom schemes are unreliable with the WHATWG URL base resolver — build explicitly.
    const base = input.mobileAppOrigin.replace(/\/$/, '');
    return `${base}/callback?${qs}`;
  }
  const dest = new URL('/auth/callback', input.webAppOrigin);
  dest.search = qs.toString();
  return dest.toString();
}

export function loginErrorRedirect(
  provider: FederatedAuthProvider,
  message: string,
  surface: AuthSurface = 'web',
): string {
  const encoded = encodeURIComponent(message);
  if (surface === 'mobile') {
    const base = mobileOrigin().replace(/\/$/, '');
    return `${base}/callback?${provider}_error=${encoded}&provider=${provider}`;
  }
  return `${webOrigin()}/login?${provider}_error=${encoded}&sso_error=${encoded}`;
}
