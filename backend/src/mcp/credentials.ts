/**
 * Per-tenant MCP credential helpers.
 *
 * Secrets live on Store.mcpCredentialsByTenant and are never returned to clients.
 */

import { getMcpProvider, type McpAuthMode } from '../../../shared/mcpProviders';
import type {
  McpAuthState,
  McpConnectErrorCode,
  ServiceId,
  TenantMcpCredentials,
  TenantMcpIamCredentials,
  TenantMcpOAuthTokens,
} from '../../../shared/types';
import type { Store } from '../store';
import { getAtlassianAccessToken } from './atlassianOAuth';
import { getProviderOAuthAccessToken, oauthAuthorizePath } from './providerOAuth';
import { resolveTransport } from './transports';

const ATLASSIAN_SERVICES = new Set<ServiceId>(['jira', 'confluence', 'bitbucket']);

const GITHUB_SERVICES = new Set<ServiceId>(['github', 'github_enterprise', 'github_projects']);

/** Services that accept a tenant PAT / API key (Wave A token path). */
const TOKEN_AUTH_MODES = new Set<McpAuthMode>(['pat', 'api_token']);

/** Env fallbacks for bearer tokens (tenant credentials win when both exist — see getServiceAccessToken). */
const ENV_TOKEN_BY_SERVICE: Partial<Record<ServiceId, string[]>> = {
  github: ['MCP_GITHUB_TOKEN'],
  github_enterprise: ['MCP_GITHUB_TOKEN'],
  github_projects: ['MCP_GITHUB_TOKEN'],
  notion: ['MCP_NOTION_TOKEN'],
  linear: ['MCP_LINEAR_TOKEN', 'MCP_LINEAR_API_KEY'],
  gitlab: ['MCP_GITLAB_TOKEN'],
  gitlab_self_managed: ['MCP_GITLAB_TOKEN', 'MCP_GITLAB_SM_TOKEN'],
  gitlab_boards: ['MCP_GITLAB_TOKEN'],
  datadog: ['MCP_DATADOG_API_KEY'],
  splunk: ['MCP_SPLUNK_TOKEN'],
  elasticsearch: ['MCP_ELASTICSEARCH_TOKEN', 'MCP_OPENSEARCH_TOKEN'],
  new_relic: ['MCP_NEW_RELIC_API_KEY'],
  grafana_loki: ['MCP_GRAFANA_TOKEN', 'MCP_LOKI_TOKEN'],
  azure_devops: ['MCP_AZURE_DEVOPS_TOKEN', 'AZURE_DEVOPS_PAT'],
  azure_repos: ['MCP_AZURE_DEVOPS_TOKEN', 'AZURE_DEVOPS_PAT'],
  slack: ['MCP_SLACK_TOKEN'],
  cursor: ['MCP_CURSOR_TOKEN'],
};

/** OAuth provider family for a service (Wave B). */
export const OAUTH_PROVIDER_BY_SERVICE: Partial<Record<ServiceId, string>> = {
  jira: 'atlassian',
  confluence: 'atlassian',
  bitbucket: 'atlassian',
  linear: 'linear',
  gitlab: 'gitlab',
  gitlab_boards: 'gitlab',
  slack: 'slack',
  teams: 'microsoft',
  outlook: 'microsoft',
  gmail: 'google',
  google_drive: 'google',
};

const IAM_SERVICES = new Set<ServiceId>(['aws', 'aws_cloudwatch', 'gcp', 'azure']);

export function isAtlassianService(serviceId: ServiceId): boolean {
  return ATLASSIAN_SERVICES.has(serviceId);
}

export function isGithubService(serviceId: ServiceId): boolean {
  return GITHUB_SERVICES.has(serviceId);
}

export function isTokenAuthService(serviceId: ServiceId): boolean {
  if (isAtlassianService(serviceId)) return false;
  const mode = getMcpProvider(serviceId)?.authMode;
  return Boolean(mode && TOKEN_AUTH_MODES.has(mode));
}

export function isIamService(serviceId: ServiceId): boolean {
  return IAM_SERVICES.has(serviceId);
}

export function tenantCredentials(store: Store, tenantId: string): TenantMcpCredentials {
  if (!store.mcpCredentialsByTenant[tenantId]) {
    store.mcpCredentialsByTenant[tenantId] = {};
  }
  return store.mcpCredentialsByTenant[tenantId]!;
}

function envFirst(names: string[] | undefined): string | undefined {
  if (!names) return undefined;
  for (const name of names) {
    const v = process.env[name]?.trim();
    if (v) return v;
  }
  return undefined;
}

/**
 * Resolve bearer / PAT for a service: tenant credential first, then env fallback.
 * GitHub also reads the legacy `github.token` field.
 */
export function getServiceAccessToken(
  store: Store | undefined,
  tenantId: string | undefined,
  serviceId: ServiceId,
): string | undefined {
  if (store && tenantId) {
    const creds = tenantCredentials(store, tenantId);
    if (isGithubService(serviceId)) {
      const legacy = creds.github?.token?.trim();
      if (legacy) return legacy;
    }
    const keyed = creds.tokensByServiceId?.[serviceId]?.token?.trim();
    if (keyed) return keyed;
    // GitHub family shares one token.
    if (isGithubService(serviceId)) {
      const gh =
        creds.tokensByServiceId?.github?.token?.trim() ||
        creds.tokensByServiceId?.github_enterprise?.token?.trim() ||
        creds.tokensByServiceId?.github_projects?.token?.trim();
      if (gh) return gh;
    }
  }
  return envFirst(ENV_TOKEN_BY_SERVICE[serviceId]);
}

/** @deprecated Prefer getServiceAccessToken */
export function getGithubAccessToken(store: Store | undefined, tenantId?: string): string | undefined {
  return getServiceAccessToken(store, tenantId, 'github');
}

export function setAtlassianCredentials(
  store: Store,
  tenantId: string,
  input: { accessToken: string; refreshToken?: string; expiresIn?: number },
): void {
  const creds = tenantCredentials(store, tenantId);
  creds.atlassian = {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    expiresAt:
      typeof input.expiresIn === 'number' ? Date.now() + input.expiresIn * 1000 : undefined,
  };
}

export function setGithubCredentials(store: Store, tenantId: string, token: string): void {
  setServiceToken(store, tenantId, 'github', token);
}

export function setServiceToken(
  store: Store,
  tenantId: string,
  serviceId: ServiceId,
  token: string,
): void {
  const trimmed = token.trim();
  if (!trimmed) throw new Error('Token is required');
  const allowsToken =
    isTokenAuthService(serviceId) ||
    isGithubService(serviceId) ||
    Boolean(ENV_TOKEN_BY_SERVICE[serviceId]);
  if (!allowsToken) {
    throw new Error(`Service '${serviceId}' does not accept a stored API token`);
  }
  const creds = tenantCredentials(store, tenantId);
  if (!creds.tokensByServiceId) creds.tokensByServiceId = {};
  // GitHub family shares one PAT.
  if (isGithubService(serviceId)) {
    creds.github = { token: trimmed };
    creds.tokensByServiceId.github = { token: trimmed };
    return;
  }
  creds.tokensByServiceId[serviceId] = { token: trimmed };
}

export function setProviderOAuthCredentials(
  store: Store,
  tenantId: string,
  provider: string,
  input: { accessToken: string; refreshToken?: string; expiresIn?: number },
): void {
  const creds = tenantCredentials(store, tenantId);
  if (!creds.oauthByProvider) creds.oauthByProvider = {};
  const tokens: TenantMcpOAuthTokens = {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    expiresAt:
      typeof input.expiresIn === 'number' ? Date.now() + input.expiresIn * 1000 : undefined,
  };
  if (provider === 'atlassian') {
    creds.atlassian = tokens;
  }
  creds.oauthByProvider[provider] = tokens;
}

export function setIamCredentials(
  store: Store,
  tenantId: string,
  serviceId: ServiceId,
  input: TenantMcpIamCredentials,
): void {
  if (!isIamService(serviceId)) {
    throw new Error(`Service '${serviceId}' does not use IAM credentials`);
  }
  const hasAny =
    Boolean(input.roleArn?.trim()) ||
    Boolean(input.subscriptionId?.trim()) ||
    Boolean(input.azureTenantId?.trim()) ||
    Boolean(input.projectId?.trim()) ||
    Boolean(input.clientId?.trim());
  if (!hasAny) throw new Error('At least one IAM identifier is required');
  const creds = tenantCredentials(store, tenantId);
  if (!creds.iamByServiceId) creds.iamByServiceId = {};
  creds.iamByServiceId[serviceId] = {
    roleArn: input.roleArn?.trim() || undefined,
    subscriptionId: input.subscriptionId?.trim() || undefined,
    azureTenantId: input.azureTenantId?.trim() || undefined,
    projectId: input.projectId?.trim() || undefined,
    clientId: input.clientId?.trim() || undefined,
  };
}

export function getIamCredentials(
  store: Store | undefined,
  tenantId: string | undefined,
  serviceId: ServiceId,
): TenantMcpIamCredentials | undefined {
  if (!store || !tenantId) return undefined;
  return tenantCredentials(store, tenantId).iamByServiceId?.[serviceId];
}

export function hasIamLinkage(
  store: Store | undefined,
  tenantId: string | undefined,
  serviceId: ServiceId,
): boolean {
  const iam = getIamCredentials(store, tenantId, serviceId);
  if (iam) {
    if (serviceId === 'aws' || serviceId === 'aws_cloudwatch') {
      if (iam.roleArn) return true;
    }
    if (serviceId === 'gcp' && iam.projectId) return true;
    if (serviceId === 'azure' && (iam.subscriptionId || iam.azureTenantId || iam.clientId)) {
      return true;
    }
  }
  // Env fallbacks
  if (serviceId === 'aws' || serviceId === 'aws_cloudwatch') {
    return Boolean(process.env.AWS_ROLE_ARN?.trim());
  }
  if (serviceId === 'gcp') {
    return Boolean(process.env.GCP_PROJECT_ID?.trim() || process.env.MCP_GCP_URL?.trim());
  }
  if (serviceId === 'azure') {
    return Boolean(
      process.env.AZURE_SUBSCRIPTION_ID?.trim() ||
        process.env.AZURE_TENANT_ID?.trim() ||
        process.env.MCP_AZURE_URL?.trim(),
    );
  }
  return false;
}

export type CredentialsStatusResponse = {
  atlassian: { hasAccessToken: boolean };
  github: { hasToken: boolean };
  tokens: Partial<Record<ServiceId, { hasToken: boolean }>>;
  oauth: Record<string, { hasAccessToken: boolean }>;
  iam: Partial<Record<ServiceId, { linked: boolean }>>;
};

export function credentialsStatus(store: Store, tenantId: string): CredentialsStatusResponse {
  const tokens: CredentialsStatusResponse['tokens'] = {};
  for (const serviceId of Object.keys(ENV_TOKEN_BY_SERVICE) as ServiceId[]) {
    tokens[serviceId] = {
      hasToken: Boolean(getServiceAccessToken(store, tenantId, serviceId)),
    };
  }
  // Ensure github family is accurate even if env map missed a key.
  const githubHas = Boolean(getServiceAccessToken(store, tenantId, 'github'));
  tokens.github = { hasToken: githubHas };
  tokens.github_enterprise = { hasToken: githubHas };
  tokens.github_projects = { hasToken: githubHas };

  const oauth: CredentialsStatusResponse['oauth'] = {
    atlassian: {
      hasAccessToken: Boolean(getAtlassianAccessToken({ store, tenantId })),
    },
  };
  for (const provider of ['linear', 'gitlab', 'slack', 'microsoft', 'google'] as const) {
    oauth[provider] = {
      hasAccessToken: Boolean(getProviderOAuthAccessToken(store, tenantId, provider)),
    };
  }

  const iam: CredentialsStatusResponse['iam'] = {};
  for (const id of IAM_SERVICES) {
    iam[id] = { linked: hasIamLinkage(store, tenantId, id) };
  }

  return {
    atlassian: oauth.atlassian!,
    github: { hasToken: githubHas },
    tokens,
    oauth,
    iam,
  };
}

export type ConnectPrecheck =
  | { ok: true; authState: McpAuthState; live: boolean }
  | {
      ok: false;
      code: McpConnectErrorCode;
      error: string;
      authState: McpAuthState;
      authorizePath?: string;
      status: number;
    };

/**
 * Honest connect gating: require real auth; refuse stub-only transports without credentials.
 */
export function precheckConnect(
  store: Store,
  tenantId: string,
  serviceId: ServiceId,
): ConnectPrecheck {
  const transport = resolveTransport(serviceId);
  const provider = getMcpProvider(serviceId);

  // —— Cursor bridge: never fake Connected ——
  if (serviceId === 'cursor') {
    return {
      ok: false,
      code: 'transport_unavailable',
      error:
        'Cursor is primarily an MCP client. Configure a documented agent-kit bridge endpoint (MCP_CURSOR_BRIDGE_URL) — Connect will not mark Cursor as live without a real bridge.',
      authState: 'none',
      status: 400,
    };
  }

  // —— Atlassian OAuth ——
  if (isAtlassianService(serviceId)) {
    const atlassianToken = getAtlassianAccessToken({ store, tenantId });
    if (!atlassianToken) {
      return {
        ok: false,
        code: 'oauth_required',
        error: 'Atlassian OAuth is required before connecting this MCP provider',
        authState: 'oauth_required',
        authorizePath: '/api/v1/mcp/oauth/atlassian/start',
        status: 409,
      };
    }
    const live = Boolean(transport.ready || transport.endpoint);
    if (!live) {
      return {
        ok: false,
        code: 'transport_unavailable',
        error: 'Atlassian MCP transport is not configured',
        authState: 'error',
        status: 400,
      };
    }
    return { ok: true, authState: 'ready', live: true };
  }

  // —— GitHub PAT ——
  if (isGithubService(serviceId)) {
    if (!getServiceAccessToken(store, tenantId, serviceId)) {
      return {
        ok: false,
        code: 'token_required',
        error: 'A GitHub personal access token is required before connecting',
        authState: 'token_required',
        status: 409,
      };
    }
    return { ok: true, authState: 'ready', live: true };
  }

  // —— IAM / cloud role ——
  if (isIamService(serviceId)) {
    if (!hasIamLinkage(store, tenantId, serviceId)) {
      return {
        ok: false,
        code: 'token_required',
        error: `Cloud IAM linkage is required for '${serviceId}' (role ARN / project / subscription)`,
        authState: 'token_required',
        status: 409,
      };
    }
    if (!transport.endpoint && !transport.ready) {
      return {
        ok: false,
        code: 'transport_unavailable',
        error: `MCP transport is not configured for '${serviceId}'`,
        authState: 'error',
        status: 400,
      };
    }
    return { ok: true, authState: 'ready', live: true };
  }

  // —— Token / PAT / API key providers ——
  if (isTokenAuthService(serviceId)) {
    const oauthFamily = OAUTH_PROVIDER_BY_SERVICE[serviceId];
    const hasToken =
      Boolean(getServiceAccessToken(store, tenantId, serviceId)) ||
      Boolean(oauthFamily && getProviderOAuthAccessToken(store, tenantId, oauthFamily));
    if (!hasToken) {
      return {
        ok: false,
        code: 'token_required',
        error: `An API token or PAT is required before connecting '${serviceId}'`,
        authState: 'token_required',
        status: 409,
      };
    }
    // Default MCP endpoint + tenant bearer unlocks live (same as GitHub).
    if (transport.endpoint || transport.ready) {
      return { ok: true, authState: 'ready', live: true };
    }
    return {
      ok: false,
      code: 'transport_unavailable',
      error: `MCP transport endpoint is not configured for '${serviceId}'`,
      authState: 'error',
      status: 400,
    };
  }

  // —— OAuth providers (Linear may also use token path via api_token mode) ——
  const oauthFamily = OAUTH_PROVIDER_BY_SERVICE[serviceId];
  if (provider?.authMode === 'oauth' && oauthFamily && oauthFamily !== 'atlassian') {
    const oauthToken = getProviderOAuthAccessToken(store, tenantId, oauthFamily);
    const envOrTenantToken = getServiceAccessToken(store, tenantId, serviceId);
    if (!oauthToken && !envOrTenantToken) {
      return {
        ok: false,
        code: 'oauth_required',
        error: `OAuth authorization is required before connecting '${serviceId}'`,
        authState: 'oauth_required',
        authorizePath: oauthAuthorizePath(oauthFamily),
        status: 409,
      };
    }
    // OAuth (or PAT fallback) unblocks Connect; live when an MCP endpoint exists.
    if (!transport.endpoint && !transport.ready) {
      return { ok: true, authState: 'ready', live: false };
    }
    return { ok: true, authState: 'ready', live: true };
  }

  if (!transport.ready && !transport.endpoint) {
    return {
      ok: false,
      code: 'transport_unavailable',
      error: `MCP transport is not configured for '${serviceId}'`,
      authState: 'none',
      status: 400,
    };
  }

  return { ok: true, authState: 'ready', live: Boolean(transport.ready || transport.endpoint) };
}

export function authStateForService(
  store: Store,
  tenantId: string,
  serviceId: ServiceId,
): McpAuthState {
  const check = precheckConnect(store, tenantId, serviceId);
  return check.authState;
}
