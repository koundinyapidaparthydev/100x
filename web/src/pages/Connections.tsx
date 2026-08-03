import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@shared/api';
import {
  getMcpProvider,
  mcpAvailabilityLabel,
  toolsForPermissionLevel,
  type McpPermissionLevel,
} from '@shared/mcpProviders';
import type { OnboardingProfile, ServiceId, ServiceMcpConnection } from '@shared/types';
import { Button, Card, Chip, PageContainer, PageHeader, StatusBadge } from '../components/ui';
import {
  getService,
  mcpStatusLabel,
  SERVICE_CATEGORY_LABELS,
  type ServiceCatalogEntry,
} from '../lib/serviceCatalog';
import { readOnboardingProfile, writeOnboardingProfile } from '../lib/onboardingStorage';
import { cn } from '../lib/utils';

type AtlassianOAuthStatus = {
  enabled: boolean;
  authorizeReady: boolean;
  hasAccessToken: boolean;
  note: string;
};

type ConnectionRow = ServiceCatalogEntry & { selected: true };

function rowsFromProfile(profile: OnboardingProfile | null): ConnectionRow[] {
  if (!profile) return [];
  return profile.selectedServices
    .map((id) => getService(id))
    .filter((entry): entry is ServiceCatalogEntry => Boolean(entry))
    .map((entry) => ({ ...entry, selected: true as const }));
}

const LEVEL_HELP: Record<McpPermissionLevel, string> = {
  read: 'Read-only tools. Safest for first connect.',
  write: 'Read + mutating tools (comments, updates, PRs).',
  admin: 'Includes admin/webhook-style tools when the server offers them.',
};

export default function Connections() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<OnboardingProfile | null>(() => readOnboardingProfile());
  const [connections, setConnections] = useState<ServiceMcpConnection[]>([]);
  const [atlassianOAuth, setAtlassianOAuth] = useState<AtlassianOAuthStatus | null>(null);
  const [secureFor, setSecureFor] = useState<ServiceId | null>(null);
  const [connectFor, setConnectFor] = useState<ServiceId | null>(null);
  const [level, setLevel] = useState<McpPermissionLevel>('read');
  const [busyId, setBusyId] = useState<ServiceId | null>(null);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshConnections = async () => {
    try {
      const res = await api.listMcpConnections();
      setConnections(res.connections);
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

  useEffect(() => {
    const flag = searchParams.get('atlassian_mcp');
    if (flag === 'ok') {
      setNotice('Atlassian MCP OAuth succeeded — you can connect Jira / Confluence / Bitbucket.');
      void refreshAtlassianOAuth();
      setSearchParams({}, { replace: true });
    } else if (flag === 'error') {
      setError(searchParams.get('atlassian_mcp_error') || 'Atlassian MCP OAuth failed');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getOnboarding();
        if (!cancelled && res.profile) {
          writeOnboardingProfile(res.profile);
          setProfile(res.profile);
        }
        if (!cancelled) {
          await refreshConnections();
          await refreshAtlassianOAuth();
        }
      } catch {
        /* keep local draft */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startAtlassianOAuth = async () => {
    setOauthBusy(true);
    setError(null);
    try {
      const { authorizeUrl } = await api.startAtlassianMcpOAuth();
      window.location.assign(authorizeUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start Atlassian OAuth');
      setOauthBusy(false);
    }
  };

  const rows = rowsFromProfile(profile);
  const secureEntry = secureFor ? getService(secureFor) : null;
  const connectProvider = connectFor ? getMcpProvider(connectFor) : null;
  const connectedCount = connections.filter((c) => c.status === 'connected').length;

  const connectionFor = (id: ServiceId) => connections.find((c) => c.serviceId === id);

  const onConnect = async (serviceId: ServiceId, permissionLevel: McpPermissionLevel) => {
    setBusyId(serviceId);
    setError(null);
    try {
      const { connection } = await api.connectMcpService(serviceId, permissionLevel);
      setConnections((prev) => {
        const rest = prev.filter((c) => c.serviceId !== serviceId);
        return [...rest, connection];
      });
      setConnectFor(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connect failed');
    } finally {
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

  return (
    <PageContainer data-testid="connections-page" width="operational">
      <PageHeader
        eyebrow="Integrations"
        title="Connections"
        description="Connect each MCP provider one-by-one. Pick a permission level — the MCP server still enforces the user’s real ACLs."
        actions={
          <Button type="button" onClick={() => navigate('/console')} data-testid="connections-to-projects">
            Go to console
          </Button>
        }
      />

      {rows.length > 0 && (
        <p className="mt-4 text-sm text-on-surface-variant" data-testid="connections-progress">
          {connectedCount} of {rows.length} selected services connected via MCP
        </p>
      )}

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

      {atlassianOAuth?.authorizeReady && (
        <Card
          className="mt-4"
          title="Atlassian MCP OAuth"
          description={atlassianOAuth.note}
          hierarchy="secondary"
          data-testid="atlassian-oauth-card"
          actions={
            <Button
              type="button"
              loading={oauthBusy}
              disabled={atlassianOAuth.hasAccessToken}
              data-testid="atlassian-oauth-start"
              onClick={() => void startAtlassianOAuth()}
            >
              {atlassianOAuth.hasAccessToken ? 'Token ready' : 'Authorize Atlassian'}
            </Button>
          }
        >
          <p className="text-xs text-on-surface-variant">
            Required for live Jira / Confluence / Bitbucket MCP calls. Demo Connect still works
            without it.
          </p>
        </Card>
      )}

      {loading && rows.length === 0 && (
        <p className="mt-8 text-sm text-on-surface-variant">Loading connection preferences…</p>
      )}

      {!loading && rows.length === 0 && (
        <Card className="mt-8" title="No services selected yet" hierarchy="secondary">
          <p className="text-sm text-on-surface-variant">
            Pick boards, chat, and code tools in onboarding — then connect each MCP provider here.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => navigate('/onboarding?edit=1')} variant="secondary">
              Open onboarding
            </Button>
            <Button onClick={() => navigate('/console')}>Continue to console</Button>
          </div>
        </Card>
      )}

      {rows.length > 0 && (
        <div className="mt-6 space-y-8" data-testid="connections-list">
          {(
            Object.entries(
              rows.reduce<Record<string, ConnectionRow[]>>((acc, row) => {
                const key = row.category;
                (acc[key] ??= []).push(row);
                return acc;
              }, {}),
            ) as [ConnectionRow['category'], ConnectionRow[]][]
          ).map(([category, categoryRows]) => (
            <section key={category} aria-labelledby={`connections-${category}`}>
              <h2
                id={`connections-${category}`}
                className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant"
              >
                {SERVICE_CATEGORY_LABELS[category]}
              </h2>
              <div className="space-y-3">
                {categoryRows.map((row) => {
                  const provider = getMcpProvider(row.id);
                  const live = connectionFor(row.id);
                  const connected = live?.status === 'connected';
                  const canConnect = Boolean(provider?.connectable);

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
                              </p>
                            )}
                            {provider?.notes && (
                              <p className="mt-1 text-xs text-on-surface-variant">{provider.notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <StatusBadge
                            status={connected ? 'available' : row.status}
                            label={
                              connected
                                ? 'Connected'
                                : canConnect
                                  ? 'Ready to connect'
                                  : mcpStatusLabel(row.status)
                            }
                            tone={connected ? 'success' : canConnect ? 'info' : 'neutral'}
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
                            <Button
                              type="button"
                              variant="primary"
                              disabled={!canConnect}
                              data-testid={`connect-${row.id}`}
                              onClick={() => {
                                setConnectFor(row.id);
                                setLevel(provider?.permissionLevels[0] ?? 'read');
                                setSecureFor(null);
                              }}
                            >
                              Connect MCP
                            </Button>
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
          ))}
        </div>
      )}

      {connectProvider && connectFor && (
        <Card
          className="mt-6"
          title={`Connect ${connectProvider.serviceId} MCP`}
          description="Choose the capability band AplifyAI may request. The provider MCP server still enforces the signed-in user’s permissions."
          hierarchy="secondary"
          actions={
            <Button type="button" variant="quiet" onClick={() => setConnectFor(null)}>
              Cancel
            </Button>
          }
          data-testid="mcp-connect-panel"
        >
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
      )}

      {secureEntry && (
        <Card
          className="mt-6"
          title={`Details · ${secureEntry.name}`}
          description={secureEntry.secureHint ?? 'Security notes for this connector.'}
          hierarchy="secondary"
          actions={
            <Button type="button" variant="quiet" onClick={() => setSecureFor(null)}>
              Close
            </Button>
          }
          data-testid="secure-setup-panel"
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
      )}

      <p className="mt-8 text-sm text-on-surface-variant">
        Need to change selections?{' '}
        <Link
          className="font-semibold text-primary underline-offset-2 hover:underline"
          to="/onboarding?edit=1"
        >
          Re-run onboarding
        </Link>
        .
      </p>
    </PageContainer>
  );
}
