/**
 * Atlassian Rovo MCP OAuth (Authorization Code + PKCE).
 *
 * - start: build authorize URL (pending state carries tenantId)
 * - callback: exchange code → access token (in-process + returned for store persist)
 * - MCP_ATLASSIAN_ACCESS_TOKEN env still overrides for long-lived tokens
 */

import { createHash, randomBytes } from 'node:crypto';
import type { Store } from '../store';

export type AtlassianMcpOAuthStatus = {
  enabled: boolean;
  authorizeReady: boolean;
  hasAccessToken: boolean;
  clientId?: string;
  redirectUri?: string;
  note: string;
};

interface PendingAtlassianAuth {
  codeVerifier: string;
  expiresAt: number;
  tenantId: string;
}

const pendingByState = new Map<string, PendingAtlassianAuth>();
const PENDING_TTL_MS = 10 * 60 * 1000;

/** In-process token from OAuth callback (demo fallback; restart clears it). */
let runtimeAccessToken: string | null = null;
let runtimeTokenExpiresAt = 0;

function trimEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

function base64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pkceChallenge(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest());
}

export type AtlassianTokenLookup = {
  store?: Store;
  tenantId?: string;
};

export function getAtlassianAccessToken(lookup?: AtlassianTokenLookup): string | undefined {
  const fromEnv = trimEnv('MCP_ATLASSIAN_ACCESS_TOKEN');
  if (fromEnv) return fromEnv;

  if (lookup?.store && lookup.tenantId) {
    const stored = lookup.store.mcpCredentialsByTenant[lookup.tenantId]?.atlassian;
    if (stored?.accessToken) {
      if (typeof stored.expiresAt === 'number' && stored.expiresAt <= Date.now()) {
        /* expired — fall through to runtime */
      } else {
        return stored.accessToken;
      }
    }
  }

  if (runtimeAccessToken && runtimeTokenExpiresAt > Date.now()) return runtimeAccessToken;
  if (runtimeAccessToken && runtimeTokenExpiresAt <= Date.now()) {
    runtimeAccessToken = null;
  }
  return runtimeAccessToken ?? undefined;
}

/** Test helper — clear in-process token. */
export function clearAtlassianRuntimeToken(): void {
  runtimeAccessToken = null;
  runtimeTokenExpiresAt = 0;
}

export function getAtlassianMcpOAuthStatus(lookup?: AtlassianTokenLookup): AtlassianMcpOAuthStatus {
  const clientId = trimEnv('MCP_ATLASSIAN_CLIENT_ID');
  const redirectUri = trimEnv('MCP_ATLASSIAN_REDIRECT_URI');
  const hasAccessToken = Boolean(getAtlassianAccessToken(lookup));
  const authorizeReady = Boolean(clientId && redirectUri);

  if (!clientId && !hasAccessToken) {
    return {
      enabled: false,
      authorizeReady: false,
      hasAccessToken: false,
      note: 'Set MCP_ATLASSIAN_CLIENT_ID + MCP_ATLASSIAN_REDIRECT_URI, or MCP_ATLASSIAN_ACCESS_TOKEN for live calls.',
    };
  }

  return {
    enabled: true,
    authorizeReady,
    hasAccessToken,
    clientId,
    redirectUri,
    note: hasAccessToken
      ? 'Access token present — remote Atlassian MCP tools can use Bearer auth.'
      : 'OAuth client configured — start authorize to obtain a user token.',
  };
}

export function buildAtlassianAuthorizeUrl(
  tenantId: string,
  scopes = ['read:jira-work', 'read:confluence-content.all', 'offline_access'],
): { url: string; state: string } | null {
  const clientId = trimEnv('MCP_ATLASSIAN_CLIENT_ID');
  const redirectUri = trimEnv('MCP_ATLASSIAN_REDIRECT_URI');
  const authorizeBase =
    trimEnv('MCP_ATLASSIAN_AUTHORIZE_URL') ?? 'https://auth.atlassian.com/authorize';
  if (!clientId || !redirectUri) return null;

  const state = base64Url(randomBytes(16));
  const codeVerifier = base64Url(randomBytes(32));
  pendingByState.set(state, {
    codeVerifier,
    expiresAt: Date.now() + PENDING_TTL_MS,
    tenantId,
  });

  const url = new URL(authorizeBase);
  url.searchParams.set('audience', 'api.atlassian.com');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('code_challenge', pkceChallenge(codeVerifier));
  url.searchParams.set('code_challenge_method', 'S256');

  return { url: url.toString(), state };
}

export function consumeAtlassianPkce(
  state: string,
): { codeVerifier: string; tenantId: string } | null {
  const pending = pendingByState.get(state);
  pendingByState.delete(state);
  if (!pending || pending.expiresAt < Date.now()) return null;
  return { codeVerifier: pending.codeVerifier, tenantId: pending.tenantId };
}

export type AtlassianTokenExchangeResult = {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope?: string;
  tenantId: string;
};

/**
 * Exchange authorization code for access token and store it in-process.
 * Caller should also persist via setAtlassianCredentials(store, tenantId, …).
 */
export async function completeAtlassianOAuthCallback(input: {
  code: string;
  state: string;
}): Promise<AtlassianTokenExchangeResult> {
  const clientId = trimEnv('MCP_ATLASSIAN_CLIENT_ID');
  const clientSecret = trimEnv('MCP_ATLASSIAN_CLIENT_SECRET');
  const redirectUri = trimEnv('MCP_ATLASSIAN_REDIRECT_URI');
  const tokenUrl = trimEnv('MCP_ATLASSIAN_TOKEN_URL') ?? 'https://auth.atlassian.com/oauth/token';
  if (!clientId || !redirectUri) {
    throw new Error('Atlassian MCP OAuth is not configured');
  }

  const pending = consumeAtlassianPkce(input.state);
  if (!pending) {
    throw new Error('Invalid or expired OAuth state');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code: input.code,
    redirect_uri: redirectUri,
    code_verifier: pending.codeVerifier,
  });
  if (clientSecret) body.set('client_secret', clientSecret);

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `Token exchange failed (${res.status})`);
  }

  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : 3600;
  runtimeAccessToken = json.access_token;
  runtimeTokenExpiresAt = Date.now() + expiresIn * 1000;

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn,
    scope: json.scope,
    tenantId: pending.tenantId,
  };
}
