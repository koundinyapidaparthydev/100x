/**
 * Shared MCP provider OAuth scaffolding (Authorization Code + PKCE).
 *
 * Mirrors Atlassian OAuth for Linear, GitLab.com, Slack, Microsoft (Teams/Outlook),
 * and Google (Gmail / Drive). Platform apps are env-gated: authorizeReady is false
 * until CLIENT_ID + REDIRECT_URI are set. Tokens persist per tenant in
 * mcpCredentialsByTenant.oauthByProvider.
 *
 * Atlassian keeps its dedicated module; this helper covers the other families.
 */

import { createHash, randomBytes } from 'node:crypto';
import type { Store } from '../store';

export type ProviderOAuthFamily = 'linear' | 'gitlab' | 'slack' | 'microsoft' | 'google';

export type ProviderOAuthStatus = {
  provider: ProviderOAuthFamily;
  enabled: boolean;
  authorizeReady: boolean;
  hasAccessToken: boolean;
  clientId?: string;
  redirectUri?: string;
  note: string;
};

interface PendingAuth {
  codeVerifier: string;
  expiresAt: number;
  tenantId: string;
  provider: ProviderOAuthFamily;
}

const pendingByState = new Map<string, PendingAuth>();
const PENDING_TTL_MS = 10 * 60 * 1000;

type ProviderEnv = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  accessTokenEnv?: string;
};

const PROVIDER_ENV: Record<
  ProviderOAuthFamily,
  {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    authorizeUrl: string;
    authorizeUrlDefault: string;
    tokenUrl: string;
    tokenUrlDefault: string;
    scopesDefault: string[];
    accessTokenEnv?: string;
  }
> = {
  linear: {
    clientId: 'MCP_LINEAR_CLIENT_ID',
    clientSecret: 'MCP_LINEAR_CLIENT_SECRET',
    redirectUri: 'MCP_LINEAR_REDIRECT_URI',
    authorizeUrl: 'MCP_LINEAR_AUTHORIZE_URL',
    authorizeUrlDefault: 'https://linear.app/oauth/authorize',
    tokenUrl: 'MCP_LINEAR_TOKEN_URL',
    tokenUrlDefault: 'https://api.linear.app/oauth/token',
    scopesDefault: ['read', 'write'],
    accessTokenEnv: 'MCP_LINEAR_ACCESS_TOKEN',
  },
  gitlab: {
    clientId: 'MCP_GITLAB_CLIENT_ID',
    clientSecret: 'MCP_GITLAB_CLIENT_SECRET',
    redirectUri: 'MCP_GITLAB_REDIRECT_URI',
    authorizeUrl: 'MCP_GITLAB_AUTHORIZE_URL',
    authorizeUrlDefault: 'https://gitlab.com/oauth/authorize',
    tokenUrl: 'MCP_GITLAB_TOKEN_URL',
    tokenUrlDefault: 'https://gitlab.com/oauth/token',
    scopesDefault: ['api', 'read_api'],
    accessTokenEnv: 'MCP_GITLAB_ACCESS_TOKEN',
  },
  slack: {
    clientId: 'MCP_SLACK_CLIENT_ID',
    clientSecret: 'MCP_SLACK_CLIENT_SECRET',
    redirectUri: 'MCP_SLACK_REDIRECT_URI',
    authorizeUrl: 'MCP_SLACK_AUTHORIZE_URL',
    authorizeUrlDefault: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'MCP_SLACK_TOKEN_URL',
    tokenUrlDefault: 'https://slack.com/api/oauth.v2.access',
    scopesDefault: ['channels:history', 'channels:read', 'chat:write', 'search:read'],
    accessTokenEnv: 'MCP_SLACK_ACCESS_TOKEN',
  },
  microsoft: {
    clientId: 'MCP_MICROSOFT_CLIENT_ID',
    clientSecret: 'MCP_MICROSOFT_CLIENT_SECRET',
    redirectUri: 'MCP_MICROSOFT_REDIRECT_URI',
    authorizeUrl: 'MCP_MICROSOFT_AUTHORIZE_URL',
    authorizeUrlDefault: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'MCP_MICROSOFT_TOKEN_URL',
    tokenUrlDefault: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopesDefault: ['openid', 'profile', 'offline_access', 'User.Read', 'Chat.Read', 'Mail.Read'],
    accessTokenEnv: 'MCP_MICROSOFT_ACCESS_TOKEN',
  },
  google: {
    clientId: 'MCP_GOOGLE_MCP_CLIENT_ID',
    clientSecret: 'MCP_GOOGLE_MCP_CLIENT_SECRET',
    redirectUri: 'MCP_GOOGLE_MCP_REDIRECT_URI',
    authorizeUrl: 'MCP_GOOGLE_MCP_AUTHORIZE_URL',
    authorizeUrlDefault: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'MCP_GOOGLE_MCP_TOKEN_URL',
    tokenUrlDefault: 'https://oauth2.googleapis.com/token',
    scopesDefault: [
      'openid',
      'email',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
    accessTokenEnv: 'MCP_GOOGLE_MCP_ACCESS_TOKEN',
  },
};

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

function resolveEnv(provider: ProviderOAuthFamily): ProviderEnv | null {
  const cfg = PROVIDER_ENV[provider];
  const clientId = trimEnv(cfg.clientId);
  const redirectUri = trimEnv(cfg.redirectUri);
  if (!clientId || !redirectUri) return null;
  return {
    clientId,
    clientSecret: trimEnv(cfg.clientSecret) ?? '',
    redirectUri,
    authorizeUrl: trimEnv(cfg.authorizeUrl) ?? cfg.authorizeUrlDefault,
    tokenUrl: trimEnv(cfg.tokenUrl) ?? cfg.tokenUrlDefault,
    scopes: cfg.scopesDefault,
    accessTokenEnv: cfg.accessTokenEnv,
  };
}

export function isProviderOAuthFamily(value: string): value is ProviderOAuthFamily {
  return value in PROVIDER_ENV;
}

export function oauthAuthorizePath(provider: string): string {
  return `/api/v1/mcp/oauth/${encodeURIComponent(provider)}/start`;
}

export function getProviderOAuthAccessToken(
  store: Store | undefined,
  tenantId: string | undefined,
  provider: string,
): string | undefined {
  const cfg = isProviderOAuthFamily(provider) ? PROVIDER_ENV[provider] : undefined;
  if (cfg?.accessTokenEnv) {
    const fromEnv = trimEnv(cfg.accessTokenEnv);
    if (fromEnv) return fromEnv;
  }
  if (!store || !tenantId) return undefined;
  const stored = store.mcpCredentialsByTenant[tenantId]?.oauthByProvider?.[provider];
  if (!stored?.accessToken) return undefined;
  if (typeof stored.expiresAt === 'number' && stored.expiresAt <= Date.now()) {
    return undefined;
  }
  return stored.accessToken;
}

export function getProviderOAuthStatus(
  provider: ProviderOAuthFamily,
  lookup?: { store?: Store; tenantId?: string },
): ProviderOAuthStatus {
  const cfg = PROVIDER_ENV[provider];
  const clientId = trimEnv(cfg.clientId);
  const redirectUri = trimEnv(cfg.redirectUri);
  const hasAccessToken = Boolean(
    getProviderOAuthAccessToken(lookup?.store, lookup?.tenantId, provider),
  );
  const authorizeReady = Boolean(clientId && redirectUri);

  if (!clientId && !hasAccessToken) {
    return {
      provider,
      enabled: false,
      authorizeReady: false,
      hasAccessToken: false,
      note: `Set ${cfg.clientId} + ${cfg.redirectUri} (and secret) for OAuth, or a long-lived ${cfg.accessTokenEnv ?? 'access token'} for live calls.`,
    };
  }

  return {
    provider,
    enabled: true,
    authorizeReady,
    hasAccessToken,
    clientId: clientId ?? undefined,
    redirectUri: redirectUri ?? undefined,
    note: hasAccessToken
      ? `Access token present for ${provider} — remote MCP can use Bearer auth.`
      : `OAuth client configured for ${provider} — start authorize to obtain a user token.`,
  };
}

export function listProviderOAuthStatuses(lookup?: {
  store?: Store;
  tenantId?: string;
}): ProviderOAuthStatus[] {
  return (Object.keys(PROVIDER_ENV) as ProviderOAuthFamily[]).map((p) =>
    getProviderOAuthStatus(p, lookup),
  );
}

export function buildProviderAuthorizeUrl(
  provider: ProviderOAuthFamily,
  tenantId: string,
): { url: string; state: string } | null {
  const env = resolveEnv(provider);
  if (!env) return null;

  const state = base64Url(randomBytes(16));
  const codeVerifier = base64Url(randomBytes(32));
  pendingByState.set(state, {
    codeVerifier,
    expiresAt: Date.now() + PENDING_TTL_MS,
    tenantId,
    provider,
  });

  const url = new URL(env.authorizeUrl);
  url.searchParams.set('client_id', env.clientId);
  url.searchParams.set('redirect_uri', env.redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', env.scopes.join(' '));
  url.searchParams.set('code_challenge', pkceChallenge(codeVerifier));
  url.searchParams.set('code_challenge_method', 'S256');

  if (provider === 'google') {
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
  }
  if (provider === 'microsoft') {
    url.searchParams.set('response_mode', 'query');
  }

  return { url: url.toString(), state };
}

export function consumeProviderPkce(
  state: string,
): { codeVerifier: string; tenantId: string; provider: ProviderOAuthFamily } | null {
  const pending = pendingByState.get(state);
  pendingByState.delete(state);
  if (!pending || pending.expiresAt < Date.now()) return null;
  return {
    codeVerifier: pending.codeVerifier,
    tenantId: pending.tenantId,
    provider: pending.provider,
  };
}

export type ProviderTokenExchangeResult = {
  provider: ProviderOAuthFamily;
  tenantId: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
};

export async function completeProviderOAuthCallback(input: {
  provider: ProviderOAuthFamily;
  code: string;
  state: string;
}): Promise<ProviderTokenExchangeResult> {
  const pending = consumeProviderPkce(input.state);
  if (!pending || pending.provider !== input.provider) {
    throw new Error('Invalid or expired OAuth state');
  }
  const env = resolveEnv(input.provider);
  if (!env) throw new Error(`OAuth is not configured for ${input.provider}`);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: env.redirectUri,
    client_id: env.clientId,
    code_verifier: pending.codeVerifier,
  });
  if (env.clientSecret) {
    body.set('client_secret', env.clientSecret);
  }

  const res = await fetch(env.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  const text = await res.text();
  let json: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
    // Slack oauth.v2.access shape
    ok?: boolean;
    authed_user?: { access_token?: string };
    access_token_slack?: string;
  };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error(`Token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok || json.error) {
    throw new Error(
      json.error_description || json.error || `Token exchange failed (${res.status})`,
    );
  }

  // Slack returns access_token at top level for bot; user token under authed_user.
  const accessToken =
    json.access_token ||
    json.authed_user?.access_token ||
    (typeof (json as { access_token?: string }).access_token === 'string'
      ? (json as { access_token: string }).access_token
      : undefined);

  if (!accessToken) {
    if (json.ok === false) {
      throw new Error('Slack OAuth token exchange returned ok=false');
    }
    throw new Error('Token exchange response missing access_token');
  }

  return {
    provider: input.provider,
    tenantId: pending.tenantId,
    accessToken,
    refreshToken: json.refresh_token,
    expiresIn: typeof json.expires_in === 'number' ? json.expires_in : undefined,
  };
}

/** Test helper */
export function clearProviderOAuthPending(): void {
  pendingByState.clear();
}
