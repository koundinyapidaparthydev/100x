import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, api } from '@shared/api';
import {
  getMcpProvider,
  MCP_PROVIDERS,
  mcpAvailabilityLabel,
  toolsForPermissionLevel,
  type McpAuthMode,
  type McpPermissionLevel,
} from '@shared/mcpProviders';
import type { OnboardingProfile, ServiceId, ServiceMcpConnection } from '@shared/types';
import { Button, Card, Chip, Field, PageContainer, PageHeader, StatusBadge } from '../components/ui';
import {
  getService,
  mcpStatusLabel,
  SERVICE_CATALOG,
  SERVICE_CATEGORY_LABELS,
  type ServiceCatalogEntry,
} from '../lib/serviceCatalog';
import { emptyOnboardingProfile, readOnboardingProfile, writeOnboardingProfile } from '../lib/onboardingStorage';
import {
  ACTIVE_ENV_CHANGED_EVENT,
  readCachedActiveEnvironmentId,
  writeCachedActiveEnvironmentId,
} from '../lib/environmentStorage';
import { environmentDisplayName } from '../lib/environmentLabels';
import { cn } from '../lib/utils';
import type { WorkspaceEnvironment } from '@shared/types';

type OAuthStatus = {
  enabled: boolean;
  authorizeReady: boolean;
  hasAccessToken: boolean;
  note: string;
};

type CredStatus = {
  atlassian: { hasAccessToken: boolean };
  github: { hasToken: boolean };
  tokens?: Partial<Record<ServiceId, { hasToken: boolean }>>;
  oauth?: Record<string, { hasAccessToken: boolean }>;
  iam?: Partial<Record<ServiceId, { linked: boolean }>>;
};

type TransportRow = { serviceId: ServiceId; ready: boolean; note: string; endpoint?: string };

type ConnectionRow = ServiceCatalogEntry & { selected: true };

const PENDING_CONNECT_KEY = '100x.mcp.pendingConnect';

/** Connections we surface as connectable now; everything else is Upcoming in the layout. */
const LIVE_CONNECTION_ORDER: ServiceId[] = [
  'jira',
  'slack',
  'github',
  'aws',
  'gcp',
  'azure',
  'nvidia',
];
const LIVE_CONNECTION_IDS = new Set<ServiceId>(LIVE_CONNECTION_ORDER);

const ATLASSIAN_IDS = new Set<ServiceId>(['jira', 'confluence', 'bitbucket']);
const GITHUB_IDS = new Set<ServiceId>(['github', 'github_enterprise', 'github_projects']);
const IAM_IDS = new Set<ServiceId>(['aws', 'aws_cloudwatch', 'gcp', 'azure']);

/** serviceId → OAuth provider family for Authorize buttons */
const OAUTH_FAMILY: Partial<Record<ServiceId, string>> = {
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

const OAUTH_CALLBACK_FLAGS = [
  'atlassian_mcp',
  'linear_mcp',
  'gitlab_mcp',
  'slack_mcp',
  'microsoft_mcp',
  'google_mcp',
] as const;

const LEVEL_HELP: Record<McpPermissionLevel, string> = {
  read: 'Read-only tools. Safest for first connect.',
  write: 'Read + mutating tools (comments, updates, PRs).',
  admin: 'Includes admin/webhook-style tools when the server offers them.',
};

const TOKEN_LABELS: Partial<Record<ServiceId, { title: string; hint: string; placeholder: string }>> = {
  github: {
    title: 'GitHub personal access token',
    hint: 'Stored per workspace. Env MCP_GITHUB_TOKEN is a fallback.',
    placeholder: 'ghp_…',
  },
  github_enterprise: {
    title: 'GitHub Enterprise personal access token',
    hint: 'Same PAT store as GitHub. Env MCP_GITHUB_TOKEN is a fallback.',
    placeholder: 'ghp_…',
  },
  github_projects: {
    title: 'GitHub personal access token',
    hint: 'Projects tools use the same GitHub PAT.',
    placeholder: 'ghp_…',
  },
  notion: {
    title: 'Notion integration token',
    hint: 'Create an internal integration at notion.so/my-integrations. Env MCP_NOTION_TOKEN is a fallback.',
    placeholder: 'ntn_… / secret_…',
  },
  linear: {
    title: 'Linear API key',
    hint: 'Settings → API → Personal API keys. Or use OAuth when MCP_LINEAR_CLIENT_ID is set.',
    placeholder: 'lin_api_…',
  },
  gitlab_self_managed: {
    title: 'GitLab personal / group access token',
    hint: 'Also set MCP_GITLAB_SM_URL to your instance /api/v4/mcp endpoint.',
    placeholder: 'glpat-…',
  },
  datadog: {
    title: 'Datadog API key',
    hint: 'Requires MCP_DATADOG_URL pointing at your Datadog MCP bridge.',
    placeholder: 'API key',
  },
  splunk: {
    title: 'Splunk token',
    hint: 'Requires MCP_SPLUNK_URL.',
    placeholder: 'Token',
  },
  elasticsearch: {
    title: 'Elasticsearch / OpenSearch token',
    hint: 'Requires MCP_ELASTICSEARCH_URL or MCP_OPENSEARCH_URL.',
    placeholder: 'API key / token',
  },
  new_relic: {
    title: 'New Relic API key',
    hint: 'Requires MCP_NEW_RELIC_URL.',
    placeholder: 'NRAK-…',
  },
  grafana_loki: {
    title: 'Grafana / Loki token',
    hint: 'Requires MCP_GRAFANA_LOKI_URL or MCP_LOKI_URL.',
    placeholder: 'Token',
  },
  azure_devops: {
    title: 'Azure DevOps PAT',
    hint: 'Host microsoft/azure-devops-mcp and set MCP_AZURE_DEVOPS_URL.',
    placeholder: 'PAT',
  },
  azure_repos: {
    title: 'Azure DevOps PAT',
    hint: 'Same bridge as Azure DevOps — MCP_AZURE_DEVOPS_URL + PAT.',
    placeholder: 'PAT',
  },
};

function rowsFromProfile(
  profile: OnboardingProfile | null,
  connections: ServiceMcpConnection[],
): ConnectionRow[] {
  const ids = new Set<ServiceId>([
    ...(profile?.selectedServices ?? []),
    ...connections.map((c) => c.serviceId),
  ]);
  return [...ids]
    .map((id) => getService(id))
    .filter((entry): entry is ServiceCatalogEntry => Boolean(entry))
    .map((entry) => ({ ...entry, selected: true as const }));
}

/** All connectable MCP providers (not gated by onboarding selections). */
function connectableCatalog(): ServiceCatalogEntry[] {
  const connectableIds = new Set(
    MCP_PROVIDERS.filter((p) => p.connectable && p.availability !== 'none').map((p) => p.serviceId),
  );
  return SERVICE_CATALOG.filter((s) => connectableIds.has(s.id) && !s.displayOnly);
}

function isTokenMode(mode: McpAuthMode | undefined): boolean {
  return mode === 'pat' || mode === 'api_token';
}

function hasServiceToken(creds: CredStatus | null, serviceId: ServiceId): boolean {
  if (!creds) return false;
  if (GITHUB_IDS.has(serviceId)) return Boolean(creds.github.hasToken || creds.tokens?.github?.hasToken);
  return Boolean(creds.tokens?.[serviceId]?.hasToken);
}

function hasOAuthToken(
  creds: CredStatus | null,
  atlassianOAuth: OAuthStatus | null,
  oauthByProvider: Record<string, OAuthStatus>,
  serviceId: ServiceId,
): boolean {
  const family = OAUTH_FAMILY[serviceId];
  if (!family) return false;
  if (family === 'atlassian') {
    return Boolean(creds?.atlassian.hasAccessToken || atlassianOAuth?.hasAccessToken);
  }
  return Boolean(creds?.oauth?.[family]?.hasAccessToken || oauthByProvider[family]?.hasAccessToken);
}

function oauthReady(
  atlassianOAuth: OAuthStatus | null,
  oauthByProvider: Record<string, OAuthStatus>,
  serviceId: ServiceId,
): boolean {
  const family = OAUTH_FAMILY[serviceId];
  if (!family) return false;
  if (family === 'atlassian') return Boolean(atlassianOAuth?.authorizeReady);
  return Boolean(oauthByProvider[family]?.authorizeReady);
}

type BadgeView = {
  label: string;
  tone: 'success' | 'info' | 'neutral' | 'warning' | 'danger';
  status: 'available' | 'planned' | 'needs_secure_setup';
};

function badgeFor(opts: {
  serviceId: ServiceId;
  live: ServiceMcpConnection | undefined;
  creds: CredStatus | null;
  transports: TransportRow[];
  atlassianOAuth: OAuthStatus | null;
  oauthByProvider: Record<string, OAuthStatus>;
}): BadgeView {
  const { serviceId, live, creds, transports, atlassianOAuth, oauthByProvider } = opts;
  if (live?.status === 'connected') {
    if (live.live) {
      return { label: 'Connected (live)', tone: 'success', status: 'available' };
    }
    return { label: 'Connected (demo)', tone: 'info', status: 'available' };
  }

  const transport = transports.find((t) => t.serviceId === serviceId);
  const provider = getMcpProvider(serviceId);

  if (serviceId === 'cursor') {
    return {
      label: transport?.ready ? 'Bridge ready' : 'Bridge only',
      tone: 'neutral',
      status: 'planned',
    };
  }

  if (ATLASSIAN_IDS.has(serviceId) && !hasOAuthToken(creds, atlassianOAuth, oauthByProvider, serviceId)) {
    if (!atlassianOAuth?.authorizeReady) {
      return { label: 'OAuth not configured', tone: 'neutral', status: 'needs_secure_setup' };
    }
    return { label: 'Needs authorize', tone: 'warning', status: 'needs_secure_setup' };
  }

  if (IAM_IDS.has(serviceId) && !creds?.iam?.[serviceId]?.linked) {
    return { label: 'Needs IAM link', tone: 'warning', status: 'needs_secure_setup' };
  }

  if (isTokenMode(provider?.authMode) && !hasServiceToken(creds, serviceId)) {
    // Linear may use OAuth instead of API key
    if (hasOAuthToken(creds, atlassianOAuth, oauthByProvider, serviceId)) {
      return { label: 'Ready', tone: 'info', status: 'available' };
    }
    // Env-backed tokens (e.g. MCP_LINEAR_TOKEN) make the transport ready even before
    // credentials/status is loaded — don't keep showing "Needs token" in that case.
    if (transport?.ready) {
      return { label: 'Ready', tone: 'info', status: 'available' };
    }
    return { label: 'Needs token', tone: 'warning', status: 'needs_secure_setup' };
  }

  if (provider?.authMode === 'oauth' && !ATLASSIAN_IDS.has(serviceId)) {
    const hasAuth =
      hasOAuthToken(creds, atlassianOAuth, oauthByProvider, serviceId) ||
      hasServiceToken(creds, serviceId);
    if (!hasAuth) {
      if (!oauthReady(atlassianOAuth, oauthByProvider, serviceId) && !transport?.ready && !transport?.endpoint) {
        return { label: 'OAuth not configured', tone: 'neutral', status: 'needs_secure_setup' };
      }
      if (oauthReady(atlassianOAuth, oauthByProvider, serviceId)) {
        return { label: 'Needs authorize', tone: 'warning', status: 'needs_secure_setup' };
      }
      if (!transport?.ready && !transport?.endpoint) {
        return { label: 'Unavailable', tone: 'neutral', status: 'planned' };
      }
      return { label: 'Needs authorize', tone: 'warning', status: 'needs_secure_setup' };
    }
  }

  // Logging / self-managed without endpoint stay Unavailable after token
  if (
    provider?.connectable &&
    isTokenMode(provider.authMode) &&
    hasServiceToken(creds, serviceId) &&
    !transport?.endpoint &&
    !transport?.ready
  ) {
    return { label: 'Needs MCP URL', tone: 'neutral', status: 'planned' };
  }

  if (provider?.connectable) {
    return { label: 'Ready', tone: 'info', status: 'available' };
  }
  return { label: mcpStatusLabel(getService(serviceId)?.status ?? 'planned'), tone: 'neutral', status: 'planned' };
}

function canConnectService(
  serviceId: ServiceId,
  transports: TransportRow[],
  atlassianOAuth: OAuthStatus | null,
  creds: CredStatus | null,
  oauthByProvider: Record<string, OAuthStatus>,
): boolean {
  // Upcoming / non-live catalog picks are Details-only — never primary Connect.
  if (!LIVE_CONNECTION_IDS.has(serviceId)) return false;
  const provider = getMcpProvider(serviceId);
  if (!provider?.connectable) return false;
  if (serviceId === 'cursor') return false;

  if (ATLASSIAN_IDS.has(serviceId)) {
    return Boolean(
      creds?.atlassian.hasAccessToken ||
        atlassianOAuth?.hasAccessToken ||
        atlassianOAuth?.authorizeReady,
    );
  }

  if (IAM_IDS.has(serviceId)) return true;

  if (isTokenMode(provider.authMode)) return true;

  if (provider.authMode === 'oauth') {
    return Boolean(
      hasOAuthToken(creds, atlassianOAuth, oauthByProvider, serviceId) ||
        oauthReady(atlassianOAuth, oauthByProvider, serviceId) ||
        transports.find((t) => t.serviceId === serviceId)?.ready ||
        transports.find((t) => t.serviceId === serviceId)?.endpoint ||
        hasServiceToken(creds, serviceId),
    );
  }

  return Boolean(transports.find((t) => t.serviceId === serviceId)?.ready);
}

function authorizeButtonLabel(family: string): string {
  switch (family) {
    case 'atlassian':
      return 'Authorize Atlassian';
    case 'linear':
      return 'Authorize Linear';
    case 'gitlab':
      return 'Authorize GitLab';
    case 'slack':
      return 'Authorize Slack';
    case 'microsoft':
      return 'Authorize Microsoft';
    case 'google':
      return 'Authorize Google';
    default:
      return `Authorize ${family}`;
  }
}

export default function Connections() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<OnboardingProfile | null>(() => readOnboardingProfile());
  const [connections, setConnections] = useState<ServiceMcpConnection[]>([]);
  const [atlassianOAuth, setAtlassianOAuth] = useState<OAuthStatus | null>(null);
  const [oauthByProvider, setOauthByProvider] = useState<Record<string, OAuthStatus>>({});
  const [creds, setCreds] = useState<CredStatus | null>(null);
  const [transports, setTransports] = useState<TransportRow[]>([]);
  const [secureFor, setSecureFor] = useState<ServiceId | null>(null);
  const [connectFor, setConnectFor] = useState<ServiceId | null>(null);
  const [level, setLevel] = useState<McpPermissionLevel>('read');
  const [patFor, setPatFor] = useState<ServiceId | null>(null);
  const [patValue, setPatValue] = useState('');
  const [iamFor, setIamFor] = useState<ServiceId | null>(null);
  const [iamRoleArn, setIamRoleArn] = useState('');
  const [iamProjectId, setIamProjectId] = useState('');
  const [iamSubscriptionId, setIamSubscriptionId] = useState('');
  const [iamAzureTenantId, setIamAzureTenantId] = useState('');
  const [iamClientId, setIamClientId] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [busyId, setBusyId] = useState<ServiceId | null>(null);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /** False until env + connection list match — hides Connected/Connect badges during settle. */
  const [envSettled, setEnvSettled] = useState(false);
  const [activeEnv, setActiveEnv] = useState<WorkspaceEnvironment | null>(null);
  const [activeEnvId, setActiveEnvId] = useState<string | null>(() =>
    readCachedActiveEnvironmentId(),
  );
  const envReloadGen = useRef(0);
  const activeEnvIdRef = useRef(activeEnvId);
  activeEnvIdRef.current = activeEnvId;

  const refreshEnvironments = async () => {
    try {
      const state = await api.listEnvironments();
      // Echo server truth without notifying listeners (Connections owns reload gating).
      writeCachedActiveEnvironmentId(state.activeEnvironmentId, { emit: false });
      setActiveEnvId(state.activeEnvironmentId);
      setActiveEnv(
        state.environments.find((e) => e.id === state.activeEnvironmentId) ??
          state.environments[0] ??
          null,
      );
    } catch {
      setActiveEnv(null);
    }
  };

  const refreshConnections = async () => {
    try {
      const res = await api.listMcpConnections();
      setConnections(res.connections);
      if (res.environmentId) {
        setActiveEnvId(res.environmentId);
        writeCachedActiveEnvironmentId(res.environmentId, { emit: false });
      }
    } catch {
      /* unauthenticated / offline — keep local empty */
    }
  };

  const refreshAtlassianOAuth = async () => {
    try {
      const status = await api.getAtlassianMcpOAuthStatus();
      setAtlassianOAuth(status);
    } catch {
      setAtlassianOAuth(null);
    }
  };

  const refreshOAuthPacks = async () => {
    try {
      const res = await api.listMcpOAuthStatuses();
      setAtlassianOAuth(res.atlassian);
      const map: Record<string, OAuthStatus> = {};
      for (const p of res.providers) {
        map[p.provider] = p;
      }
      setOauthByProvider(map);
    } catch {
      await refreshAtlassianOAuth();
    }
  };

  const refreshCreds = async () => {
    try {
      const status = await api.getMcpCredentialsStatus();
      setCreds(status);
    } catch {
      setCreds(null);
    }
  };

  const refreshTransports = async () => {
    try {
      const res = await api.listMcpTransports();
      setTransports(
        res.transports.map((t) => ({
          serviceId: t.serviceId,
          ready: t.ready,
          note: t.note,
          endpoint: t.endpoint,
        })),
      );
    } catch {
      setTransports([]);
    }
  };

  const startProviderOAuth = async (
    family: string,
    pending?: { serviceId: ServiceId; permissionLevel: McpPermissionLevel },
  ) => {
    setOauthBusy(true);
    setError(null);
    try {
      if (pending) {
        sessionStorage.setItem(PENDING_CONNECT_KEY, JSON.stringify(pending));
      }
      const { authorizeUrl } =
        family === 'atlassian'
          ? await api.startAtlassianMcpOAuth()
          : await api.startMcpProviderOAuth(family);
      window.location.assign(authorizeUrl);
    } catch (e) {
      setNotice(null);
      setError(
        e instanceof Error
          ? e.message
          : `${family} MCP OAuth is not configured on this environment.`,
      );
      setOauthBusy(false);
    }
  };

  const onConnect = async (serviceId: ServiceId, permissionLevel: McpPermissionLevel) => {
    if (!LIVE_CONNECTION_IDS.has(serviceId)) {
      setConnectFor(null);
      setError('This connector is upcoming — connect support is not available yet.');
      return;
    }
    setBusyId(serviceId);
    setError(null);
    try {
      const { connection } = await api.connectMcpService(serviceId, permissionLevel);
      setConnections((prev) => {
        const rest = prev.filter((c) => c.serviceId !== serviceId);
        return [...rest, connection];
      });
      setConnectFor(null);
      setPatFor(null);
      setIamFor(null);
      setNotice(`${getService(serviceId)?.name ?? serviceId} connected${connection.live ? ' (live)' : ''}.`);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'oauth_required') {
          const family = OAUTH_FAMILY[serviceId] ?? 'atlassian';
          const ready =
            family === 'atlassian'
              ? atlassianOAuth?.authorizeReady
              : oauthByProvider[family]?.authorizeReady;
          if (!ready) {
            setNotice(null);
            setConnectFor(null);
            setError(
              `${family} MCP OAuth is not configured. Set CLIENT_ID / CLIENT_SECRET / REDIRECT_URI on the API, then retry.`,
            );
            return;
          }
          setNotice(`Redirecting to ${family} to authorize…`);
          await startProviderOAuth(family, { serviceId, permissionLevel });
          return;
        }
        if (e.code === 'token_required') {
          if (IAM_IDS.has(serviceId)) {
            setIamFor(serviceId);
            setConnectFor(null);
            setNotice('Link cloud IAM identifiers to continue.');
            return;
          }
          setPatFor(serviceId);
          setConnectFor(null);
          setPatValue('');
          setNotice('Paste an API token or PAT to continue.');
          return;
        }
        if (e.code === 'transport_unavailable') {
          setError(e.message || 'MCP transport is not configured for this provider yet.');
          return;
        }
      }
      setError(e instanceof Error ? e.message : 'Connect failed');
    } finally {
      setBusyId(null);
    }
  };

  const onSavePatAndConnect = async () => {
    if (!patFor) return;
    setBusyId(patFor);
    setError(null);
    try {
      await api.saveMcpServiceToken(patFor, patValue);
      await refreshCreds();
      const permissionLevel = level;
      const serviceId = patFor;
      setPatFor(null);
      setPatValue('');
      await onConnect(serviceId, permissionLevel);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save token');
      setBusyId(null);
    }
  };

  const onSaveIamAndConnect = async () => {
    if (!iamFor) return;
    setBusyId(iamFor);
    setError(null);
    try {
      await api.saveMcpIamCredentials(iamFor, {
        roleArn: iamRoleArn || undefined,
        projectId: iamProjectId || undefined,
        subscriptionId: iamSubscriptionId || undefined,
        azureTenantId: iamAzureTenantId || undefined,
        clientId: iamClientId || undefined,
      });
      await refreshCreds();
      const permissionLevel = level;
      const serviceId = iamFor;
      setIamFor(null);
      await onConnect(serviceId, permissionLevel);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save IAM credentials');
      setBusyId(null);
    }
  };

  const onDisconnect = async (serviceId: ServiceId) => {
    setBusyId(serviceId);
    setError(null);
    try {
      await api.disconnectMcpService(serviceId);
      setConnections((prev) => prev.filter((c) => c.serviceId !== serviceId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Disconnect failed');
    } finally {
      setBusyId(null);
    }
  };

  const addServiceToProfile = async (serviceId: ServiceId) => {
    setError(null);
    const base = profile ?? emptyOnboardingProfile(profile?.plan ?? 'enterprise');
    if (base.selectedServices.includes(serviceId)) {
      setNotice(`${getService(serviceId)?.name ?? serviceId} is already on your list.`);
      return;
    }
    const next: OnboardingProfile = {
      ...base,
      selectedServices: [...base.selectedServices, serviceId],
      updatedAt: new Date().toISOString(),
    };
    try {
      const { profile: saved } = await api.putOnboarding({ profile: next });
      writeOnboardingProfile(saved);
      setProfile(saved);
      setNotice(`${getService(serviceId)?.name ?? serviceId} added — connect MCP when ready.`);
    } catch {
      writeOnboardingProfile(next);
      setProfile(next);
      setNotice(`${getService(serviceId)?.name ?? serviceId} added locally.`);
    }
  };

  useEffect(() => {
    for (const flag of OAUTH_CALLBACK_FLAGS) {
      const value = searchParams.get(flag);
      if (value === 'ok') {
        const label = flag.replace(/_mcp$/, '');
        setNotice(`${label} MCP OAuth succeeded — finishing pending connect if any.`);
        void (async () => {
          await refreshOAuthPacks();
          await refreshCreds();
          const raw = sessionStorage.getItem(PENDING_CONNECT_KEY);
          sessionStorage.removeItem(PENDING_CONNECT_KEY);
          if (raw) {
            try {
              const pending = JSON.parse(raw) as {
                serviceId: ServiceId;
                permissionLevel: McpPermissionLevel;
              };
              await onConnect(pending.serviceId, pending.permissionLevel);
            } catch {
              /* ignore */
            }
          }
        })();
        setSearchParams({}, { replace: true });
        return;
      }
      if (value === 'error') {
        setError(searchParams.get(`${flag}_error`) || `${flag} OAuth failed`);
        sessionStorage.removeItem(PENDING_CONNECT_KEY);
        setSearchParams({}, { replace: true });
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on OAuth return
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Onboarding hydrate is best-effort. Failure must not block OAuth / MCP
      // connection / transport / credential status used by Available badges.
      try {
        const res = await api.getOnboarding();
        if (!cancelled && res.profile) {
          writeOnboardingProfile(res.profile);
          setProfile(res.profile);
        }
      } catch {
        /* keep local draft */
      }
      if (cancelled) return;
      setEnvSettled(false);
      try {
        await Promise.all([
          refreshEnvironments(),
          refreshConnections(),
          refreshOAuthPacks(),
          refreshCreds(),
          refreshTransports(),
        ]);
      } catch {
        /* individual refresh helpers already swallow errors */
      } finally {
        if (!cancelled) {
          setLoading(false);
          setEnvSettled(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reload connections only when the active environment id actually changes.
  useEffect(() => {
    const reloadForEnv = (environmentId?: string | null) => {
      const next = environmentId ?? readCachedActiveEnvironmentId();
      if (!next || next === activeEnvIdRef.current) return;
      const gen = ++envReloadGen.current;
      setActiveEnvId(next);
      setEnvSettled(false);
      // Drop stale badges so we never flash Connected for the prior env.
      setConnections([]);
      void (async () => {
        try {
          await refreshEnvironments();
          if (envReloadGen.current !== gen) return;
          await refreshConnections();
        } finally {
          if (envReloadGen.current === gen) setEnvSettled(true);
        }
      })();
    };
    const onEnvChanged = (event: Event) => {
      const id = (event as CustomEvent<{ environmentId?: string }>).detail?.environmentId;
      reloadForEnv(id);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === '100x-active-environment') {
        reloadForEnv(readCachedActiveEnvironmentId());
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(ACTIVE_ENV_CHANGED_EVENT, onEnvChanged);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(ACTIVE_ENV_CHANGED_EVENT, onEnvChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = rowsFromProfile(profile, connections);
  const secureEntry = secureFor ? getService(secureFor) : null;
  const connectProvider = connectFor ? getMcpProvider(connectFor) : null;
  const selectedIds = new Set(profile?.selectedServices ?? []);
  const addable = connectableCatalog().filter((s) => {
    if (selectedIds.has(s.id)) return false;
    if (!addQuery.trim()) return true;
    const q = addQuery.trim().toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.id.includes(q) ||
      SERVICE_CATEGORY_LABELS[s.category].toLowerCase().includes(q)
    );
  });

  const connectionFor = (id: ServiceId) => connections.find((c) => c.serviceId === id);
  const availableRows: ConnectionRow[] = LIVE_CONNECTION_ORDER.map((id) => getService(id))
    .filter((entry): entry is ServiceCatalogEntry => Boolean(entry))
    .map((entry) => ({ ...entry, selected: true as const }));
  const upcomingRows = rows
    .filter(
      (row) =>
        !LIVE_CONNECTION_IDS.has(row.id) && connectionFor(row.id)?.status !== 'connected',
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const connectedCount = availableRows.filter(
    (row) => connectionFor(row.id)?.status === 'connected',
  ).length;
  const patMeta = patFor
    ? TOKEN_LABELS[patFor] ?? {
        title: `${getService(patFor)?.name ?? patFor} API token`,
        hint: 'Token is stored per workspace and never returned after save.',
        placeholder: 'Token',
      }
    : null;

  return (
    <PageContainer data-testid="connections-page" width="operational">
      <PageHeader
        eyebrow="Integrations"
        title="Connections"
        description="Connect vendor MCP servers one-by-one for the active workspace environment. Auth follows each vendor: OAuth, API token/PAT, or cloud IAM."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              data-testid="connections-add"
              onClick={() => setShowAdd((v) => !v)}
            >
              Add connection
            </Button>
            <Button type="button" onClick={() => navigate('/home')} data-testid="connections-to-projects">
              Go to home
            </Button>
          </div>
        }
      />

      <div
        className="mt-4 rounded-lg border border-primary/25 bg-primary-container/30 px-3 py-2.5 text-sm text-on-surface"
        data-testid="connections-env-banner"
        role="status"
      >
        Connecting for{' '}
        <strong>
          {activeEnv
            ? environmentDisplayName(activeEnv.name, activeEnv.key)
            : 'the active environment'}
        </strong>
        . Switch environments in the header to link a different stage (Prod ≠ Stage Slack).
      </div>

      <p className="mt-4 text-sm text-on-surface-variant" data-testid="connections-progress">
        {!envSettled
          ? 'Updating connections for the new environment…'
          : `${connectedCount} of ${availableRows.length} available services connected via MCP${
              upcomingRows.length > 0 ? ` · ${upcomingRows.length} upcoming` : ''
            }`}
      </p>

      {notice && (
        <p className="mt-3 text-sm text-success" role="status" data-testid="atlassian-oauth-notice">
          {notice}
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm text-error" role="alert">
          {error}
        </p>
      )}

      {showAdd && (
        <Card
          className="mt-4"
          title="Add connection"
          description="All connectable MCP providers for testing — not limited to onboarding selections."
          hierarchy="secondary"
          data-testid="connections-add-panel"
          actions={
            <Button type="button" variant="quiet" onClick={() => setShowAdd(false)}>
              Close
            </Button>
          }
        >
          <Field
            label="Search providers"
            value={addQuery}
            onChange={(e) => setAddQuery(e.target.value)}
            placeholder="Datadog, GitHub, Jira…"
            data-testid="connections-add-search"
          />
          <ul className="mt-3 max-h-64 space-y-2 overflow-auto">
            {addable.map((entry) => {
              const live = LIVE_CONNECTION_IDS.has(entry.id);
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <img src={entry.logo} alt="" width={28} height={28} className="size-7 rounded-md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-on-surface">{entry.name}</p>
                      <p className="truncate text-xs text-on-surface-variant">
                        {SERVICE_CATEGORY_LABELS[entry.category]}
                        {!live ? ' · Upcoming' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!live && <StatusBadge status="planned" label="Upcoming" tone="neutral" />}
                    <Button
                      type="button"
                      variant="secondary"
                      data-testid={`add-service-${entry.id}`}
                      onClick={() => void addServiceToProfile(entry.id)}
                    >
                      Add
                    </Button>
                  </div>
                </li>
              );
            })}
            {addable.length === 0 && (
              <li className="text-sm text-on-surface-variant">No matching connectable providers.</li>
            )}
          </ul>
        </Card>
      )}

      {(loading || !envSettled) && (
        <p className="mt-4 text-sm text-on-surface-variant" data-testid="connections-env-settling">
          {loading ? 'Loading connection status…' : 'Updating connections for environment…'}
        </p>
      )}

      {/* Gate list until env + connections settle — avoids Connected↔Connect flash. */}
      <div
        className="mt-6 space-y-8"
        data-testid="connections-list"
        aria-busy={loading || !envSettled}
        data-env-settled={envSettled ? 'true' : 'false'}
      >
        <section aria-labelledby="connections-available">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2
              id="connections-available"
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant"
            >
              Available
            </h2>
            <StatusBadge status="available" label="Ready to connect" tone="info" />
          </div>
          <div className="space-y-3">
            {(loading || !envSettled ? [] : availableRows).map((row) => {
              const provider = getMcpProvider(row.id);
              const live = connectionFor(row.id);
              const connected = live?.status === 'connected';
              const allowConnect = canConnectService(
                row.id,
                transports,
                atlassianOAuth,
                creds,
                oauthByProvider,
              );
              const badge = badgeFor({
                serviceId: row.id,
                live,
                creds,
                transports,
                atlassianOAuth,
                oauthByProvider,
              });
              const family = OAUTH_FAMILY[row.id];
              const needsAuthorize =
                Boolean(family) &&
                !hasOAuthToken(creds, atlassianOAuth, oauthByProvider, row.id) &&
                oauthReady(atlassianOAuth, oauthByProvider, row.id) &&
                !hasServiceToken(creds, row.id);

              return (
                <Card
                  key={row.id}
                  hierarchy="primary"
                  className="!p-4"
                  data-testid={`connection-${row.id}`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <img
                        src={row.logo}
                        alt=""
                        width={36}
                        height={36}
                        className="size-9 rounded-md"
                      />
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-on-surface">{row.name}</p>
                        <p className="text-sm text-on-surface-variant">
                          {provider
                            ? mcpAvailabilityLabel(provider.availability)
                            : 'No MCP option yet'}
                        </p>
                        {connected && live && (
                          <p className="mt-1 text-xs text-success">
                            Connected · {live.permissionLevel} · {live.grantedTools.length} tools
                            {live.live ? ' · live' : ''}
                          </p>
                        )}
                        {provider?.notes && (
                          <p className="mt-1 text-xs text-on-surface-variant">{provider.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <StatusBadge
                        status={badge.status}
                        label={badge.label}
                        tone={badge.tone}
                      />
                      {connected ? (
                        <Button
                          type="button"
                          variant="secondary"
                          loading={busyId === row.id}
                          data-testid={`disconnect-${row.id}`}
                          onClick={() => void onDisconnect(row.id)}
                        >
                          Disconnect
                        </Button>
                      ) : (
                        <>
                          {needsAuthorize && family && (
                            <Button
                              type="button"
                              variant="secondary"
                              loading={oauthBusy}
                              data-testid={`authorize-${row.id}`}
                              onClick={() =>
                                void startProviderOAuth(family, {
                                  serviceId: row.id,
                                  permissionLevel: provider?.permissionLevels[0] ?? 'read',
                                })
                              }
                            >
                              {authorizeButtonLabel(family)}
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="primary"
                            disabled={!allowConnect}
                            data-testid={`connect-${row.id}`}
                            title={
                              allowConnect
                                ? undefined
                                : ATLASSIAN_IDS.has(row.id) && !atlassianOAuth?.authorizeReady
                                  ? 'Atlassian OAuth is not configured on this environment'
                                  : 'MCP OAuth / transport not configured for this provider'
                            }
                            onClick={() => {
                              setConnectFor(row.id);
                              setLevel(provider?.permissionLevels[0] ?? 'read');
                              setSecureFor(null);
                              setPatFor(null);
                              setIamFor(null);
                            }}
                          >
                            Connect MCP
                          </Button>
                        </>
                      )}
                      <Button
                        type="button"
                        variant="quiet"
                        data-testid={`secure-${row.id}`}
                        onClick={() => {
                          setSecureFor(row.id);
                          setConnectFor(null);
                        }}
                      >
                        Details
                      </Button>
                    </div>
                  </div>

                  {connected && live && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {live.grantedTools.slice(0, 8).map((tool) => (
                        <Chip
                          key={tool}
                          tone="mint"
                          selected={false}
                          tabIndex={-1}
                          className="pointer-events-none"
                        >
                          {tool}
                        </Chip>
                      ))}
                      {live.grantedTools.length > 8 && (
                        <span className="text-xs text-on-surface-variant">
                          +{live.grantedTools.length - 8} more
                        </span>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>

        {envSettled && !loading && upcomingRows.length > 0 && (
          <section aria-labelledby="connections-upcoming">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2
                id="connections-upcoming"
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant"
              >
                Upcoming
              </h2>
              <StatusBadge status="planned" label="Upcoming" tone="neutral" />
            </div>
            <p className="mb-4 text-sm text-on-surface-variant">
              These connectors are on the roadmap — connect support coming later.
            </p>
            <ul
              className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
              data-testid="connections-upcoming-grid"
            >
              {(loading || !envSettled ? [] : upcomingRows).map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    data-testid={`connection-${row.id}`}
                    title={`${row.name} — Upcoming (details only)`}
                    onClick={() => {
                      // Details / secure panel only — no Connect MCP or OAuth authorize.
                      setSecureFor(row.id);
                      setConnectFor(null);
                      setPatFor(null);
                      setIamFor(null);
                    }}
                    className="flex w-full flex-col items-center gap-2 rounded-lg border border-outline-variant bg-surface px-2 py-3 text-center transition hover:border-primary/35 hover:bg-surface-container"
                  >
                    <img
                      src={row.logo}
                      alt=""
                      width={36}
                      height={36}
                      className="size-9 rounded-md opacity-80"
                    />
                    <span className="w-full truncate text-xs font-medium text-on-surface">
                      {row.name}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-on-surface-variant">
                      Upcoming
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {connectProvider && connectFor && LIVE_CONNECTION_IDS.has(connectFor) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mcp-connect-title"
          data-testid="mcp-connect-panel"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConnectFor(null);
          }}
        >
          <Card
            className="w-full max-w-lg shadow-lg"
            title={`Connect ${getService(connectFor)?.name ?? connectProvider.serviceId} MCP`}
            description="Choose the capability band 100x may request. The provider MCP server still enforces the signed-in user’s permissions."
            hierarchy="primary"
            actions={
              <Button type="button" variant="quiet" onClick={() => setConnectFor(null)}>
                Cancel
              </Button>
            }
          >
            <h2 id="mcp-connect-title" className="sr-only">
              Connect {getService(connectFor)?.name ?? connectProvider.serviceId} MCP
            </h2>
            <div className="flex flex-wrap gap-2" data-testid="mcp-permission-levels">
              {connectProvider.permissionLevels.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={level === opt}
                  onClick={() => setLevel(opt)}
                  className={cn(
                    'min-h-10 rounded-lg border px-3 text-sm font-semibold capitalize transition',
                    level === opt
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-outline-variant bg-surface hover:border-primary/40',
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-on-surface-variant">{LEVEL_HELP[level]}</p>
            <ul className="mt-3 max-h-40 list-disc space-y-1 overflow-auto pl-5 text-xs text-on-surface-variant">
              {toolsForPermissionLevel(connectProvider, level).map((t) => (
                <li key={t.name}>
                  <span className="font-medium text-on-surface">{t.name}</span>
                  {t.mutating ? ' (mutating)' : ''} — {t.description}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Button
                type="button"
                loading={busyId === connectFor}
                data-testid="mcp-connect-confirm"
                onClick={() => void onConnect(connectFor, level)}
              >
                Grant {level} & connect
              </Button>
            </div>
          </Card>
        </div>
      )}

      {patFor && patMeta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          data-testid="mcp-token-panel"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPatFor(null);
          }}
        >
          <Card
            className="w-full max-w-lg shadow-lg"
            title={patMeta.title}
            description={patMeta.hint}
            hierarchy="primary"
            actions={
              <Button type="button" variant="quiet" onClick={() => setPatFor(null)}>
                Cancel
              </Button>
            }
          >
            <Field
              label="API token / PAT"
              type="password"
              autoComplete="off"
              value={patValue}
              onChange={(e) => setPatValue(e.target.value)}
              placeholder={patMeta.placeholder}
              data-testid="mcp-token-input"
            />
            <div className="mt-4">
              <Button
                type="button"
                loading={busyId === patFor}
                disabled={!patValue.trim()}
                data-testid="mcp-token-save"
                onClick={() => void onSavePatAndConnect()}
              >
                Save token & connect
              </Button>
            </div>
          </Card>
        </div>
      )}

      {iamFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          data-testid="mcp-iam-panel"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIamFor(null);
          }}
        >
          <Card
            className="w-full max-w-lg shadow-lg"
            title={`Link ${getService(iamFor)?.name ?? iamFor} IAM`}
            description="Store role / project / subscription identifiers only — long-lived keys stay in your cloud IdP or platform env."
            hierarchy="primary"
            actions={
              <Button type="button" variant="quiet" onClick={() => setIamFor(null)}>
                Cancel
              </Button>
            }
          >
            {(iamFor === 'aws' || iamFor === 'aws_cloudwatch') && (
              <Field
                label="AWS role ARN"
                value={iamRoleArn}
                onChange={(e) => setIamRoleArn(e.target.value)}
                placeholder="arn:aws:iam::123456789012:role/X100Mcp"
                data-testid="mcp-iam-role-arn"
              />
            )}
            {iamFor === 'gcp' && (
              <Field
                label="GCP project id"
                value={iamProjectId}
                onChange={(e) => setIamProjectId(e.target.value)}
                placeholder="my-gcp-project"
                data-testid="mcp-iam-project-id"
              />
            )}
            {iamFor === 'azure' && (
              <>
                <Field
                  label="Azure subscription id"
                  value={iamSubscriptionId}
                  onChange={(e) => setIamSubscriptionId(e.target.value)}
                  data-testid="mcp-iam-subscription-id"
                />
                <Field
                  label="Azure AD tenant id"
                  value={iamAzureTenantId}
                  onChange={(e) => setIamAzureTenantId(e.target.value)}
                  data-testid="mcp-iam-azure-tenant"
                />
                <Field
                  label="Service principal client id (optional)"
                  value={iamClientId}
                  onChange={(e) => setIamClientId(e.target.value)}
                  data-testid="mcp-iam-client-id"
                />
              </>
            )}
            <div className="mt-4">
              <Button
                type="button"
                loading={busyId === iamFor}
                data-testid="mcp-iam-save"
                onClick={() => void onSaveIamAndConnect()}
              >
                Save & connect
              </Button>
            </div>
          </Card>
        </div>
      )}

      {secureEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          data-testid="secure-setup-panel"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSecureFor(null);
          }}
        >
          <Card
            className="w-full max-w-lg shadow-lg"
            title={`Details · ${secureEntry.name}`}
            description={secureEntry.secureHint ?? 'Security notes for this connector.'}
            hierarchy="primary"
            actions={
              <Button type="button" variant="quiet" onClick={() => setSecureFor(null)}>
                Close
              </Button>
            }
          >
            <ul className="list-disc space-y-1 pl-5 text-sm text-on-surface-variant">
              <li>Catalog status: {mcpStatusLabel(secureEntry.status)}</li>
              {getMcpProvider(secureEntry.id) ? (
                <>
                  <li>
                    MCP: {mcpAvailabilityLabel(getMcpProvider(secureEntry.id)!.availability)} (
                    {getMcpProvider(secureEntry.id)!.serverId})
                  </li>
                  <li>Auth: {getMcpProvider(secureEntry.id)!.authMode}</li>
                  {transports.find((t) => t.serviceId === secureEntry.id)?.note && (
                    <li>{transports.find((t) => t.serviceId === secureEntry.id)!.note}</li>
                  )}
                  {getMcpProvider(secureEntry.id)!.docsUrl && (
                    <li>
                      Docs:{' '}
                      <a
                        className="font-semibold text-primary underline-offset-2 hover:underline"
                        href={getMcpProvider(secureEntry.id)!.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        provider MCP reference
                      </a>
                    </li>
                  )}
                </>
              ) : (
                <li>No MCP server registered yet — API bridge may come later.</li>
              )}
            </ul>
          </Card>
        </div>
      )}

      <p className="mt-8 text-sm text-on-surface-variant">
        Need to change selections?{' '}
        <Link
          className="font-semibold text-primary underline-offset-2 hover:underline"
          to="/onboarding?edit=1"
        >
          Re-run onboarding
        </Link>
        {' '}
        or use Add connection above.
      </p>
    </PageContainer>
  );
}
