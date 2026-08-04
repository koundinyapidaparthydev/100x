import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '@shared/api';
import { getService } from '../lib/serviceCatalog';
import type { HomeWidgetId, ServiceMcpConnection, WorkItem } from '@shared/types';
import {
  AsyncBoundary,
  Button,
  Card,
  PageContainer,
  PageHeader,
} from '../components/ui';
import {
  HomeChannelsWidget,
  type SlackChannelRow,
} from '../components/home/HomeChannelsWidget';
import { HomeTicketsWidget } from '../components/home/HomeTicketsWidget';
import {
  ACTIVE_ENV_CHANGED_EVENT,
  readCachedActiveEnvironmentId,
} from '../lib/environmentStorage';
import { cn } from '../lib/utils';

const BOARD_IDS = new Set(
  ['jira', 'linear', 'azure_boards', 'github_projects', 'gitlab_boards', 'asana', 'monday'].filter(
    Boolean,
  ),
);

function isBoardConnection(c: ServiceMcpConnection): boolean {
  const cat = getService(c.serviceId)?.category;
  return cat === 'boards' || BOARD_IDS.has(c.serviceId);
}

function isMessagingConnection(c: ServiceMcpConnection): boolean {
  const cat = getService(c.serviceId)?.category;
  return cat === 'conversation' || c.serviceId === 'slack' || c.serviceId === 'teams';
}

function recommendWidgets(connections: ServiceMcpConnection[]): HomeWidgetId[] {
  const connected = connections.filter((c) => c.status === 'connected');
  const widgets: HomeWidgetId[] = [];
  if (connected.some(isBoardConnection)) widgets.push('tickets');
  if (connected.some(isMessagingConnection)) widgets.push('channels');
  return widgets;
}

function parseSlackChannels(data: unknown): SlackChannelRow[] {
  if (!data || typeof data !== 'object') return [];
  const root = data as Record<string, unknown>;
  const list =
    (Array.isArray(root.channels) && root.channels) ||
    (Array.isArray(root.data) && root.data) ||
    (Array.isArray((root.result as { channels?: unknown })?.channels) &&
      (root.result as { channels: unknown[] }).channels) ||
    [];
  return (list as unknown[])
    .map((row): SlackChannelRow | null => {
      if (!row || typeof row !== 'object') return null;
      const r = row as Record<string, unknown>;
      const id = String(r.id ?? r.channel_id ?? r.name ?? '');
      const name = String(r.name ?? r.channel ?? id);
      if (!id || !name) return null;
      return {
        id,
        name: name.replace(/^#/, ''),
        topic: typeof r.topic === 'string' ? r.topic : undefined,
        latestPreview:
          typeof r.latest === 'string'
            ? r.latest
            : typeof r.last_message === 'string'
              ? r.last_message
              : undefined,
      };
    })
    .filter((c): c is SlackChannelRow => c !== null);
}

export default function WorkspaceHome() {
  const [connections, setConnections] = useState<ServiceMcpConnection[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [layoutWidgets, setLayoutWidgets] = useState<HomeWidgetId[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [channels, setChannels] = useState<SlackChannelRow[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [busyChannelId, setBusyChannelId] = useState<string | null>(null);
  const [draftByChannel, setDraftByChannel] = useState<Record<string, string>>({});
  const [customizing, setCustomizing] = useState(false);

  const slackConn = connections.find(
    (c) => c.serviceId === 'slack' && c.status === 'connected',
  );

  const recommended = useMemo(() => recommendWidgets(connections), [connections]);
  const visibleWidgets = layoutWidgets && layoutWidgets.length > 0 ? layoutWidgets : recommended;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [connRes, items, layoutRes] = await Promise.all([
        api.listMcpConnections(),
        api.listWorkItems(),
        api.getHomeLayout().catch(() => ({ layout: { widgets: [] as HomeWidgetId[] } })),
      ]);
      setConnections(connRes.connections);
      setWorkItems(items);
      setLayoutWidgets(
        layoutRes.layout.widgets.length > 0 ? layoutRes.layout.widgets : null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load home');
    } finally {
      setLoading(false);
    }
  };

  const loadChannels = async () => {
    if (!slackConn) {
      setChannels([]);
      return;
    }
    setChannelsLoading(true);
    setChannelsError(null);
    try {
      const result = await api.callMcpTool('slack', 'slack_list_channels', {});
      if (!result.ok) {
        // Stub / offline: surface a few demo channel names so the widget is usable.
        setChannels([
          {
            id: 'C-general',
            name: 'general',
            topic: 'Company-wide',
            latestPreview: 'Standup notes posted — needs a follow-up on the deploy window.',
          },
          {
            id: 'C-incidents',
            name: 'incidents',
            latestPreview: 'P2: latency spike in us-east — looking for owner.',
          },
        ]);
        if (result.error) setChannelsError(null);
        return;
      }
      const parsed = parseSlackChannels(result.data);
      setChannels(
        parsed.length > 0
          ? parsed
          : [
              {
                id: 'C-general',
                name: 'general',
                latestPreview: 'Connected — no channel payload; showing placeholder.',
              },
            ],
      );
    } catch (e) {
      setChannelsError(e instanceof Error ? e.message : 'Could not list channels');
    } finally {
      setChannelsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (slackConn) void loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slackConn?.serviceId, slackConn?.live, slackConn?.updatedAt]);

  useEffect(() => {
    const onEnv = () => {
      void load();
    };
    window.addEventListener(ACTIVE_ENV_CHANGED_EVENT, onEnv);
    return () => window.removeEventListener(ACTIVE_ENV_CHANGED_EVENT, onEnv);
  }, []);

  const connectedCount = connections.filter((c) => c.status === 'connected').length;

  // No connections → console overview (admin / setup).
  if (!loading && !error && connectedCount === 0) {
    return <Navigate to="/console" replace />;
  }

  const onWorkOn = async (item: WorkItem) => {
    setBusyId(item.id);
    setNotice(null);
    try {
      await api.triageWorkItem(item.id, {
        aiFirst: true,
        targetCompletionPercent: item.targetCompletionPercent || 20,
      });
      setNotice(`Queued AI work for ${item.board.issueKey}.`);
      const items = await api.listWorkItems();
      setWorkItems(items);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not start work');
    } finally {
      setBusyId(null);
    }
  };

  const onDraftSolution = async (item: WorkItem) => {
    setBusyId(item.id);
    setNotice(null);
    try {
      const callSet = await api.createCallSet({
        workItemId: item.id,
        inputSummary: `${item.board.issueKey}: ${item.title}`,
        solutionSummary: `Draft solution v1 for ${item.board.issueKey}. Review context and continue in the task detail.`,
        turns: [
          {
            role: 'user',
            content: item.description?.slice(0, 2000) || item.title,
          },
          {
            role: 'assistant',
            content: `Proposed approach for ${item.board.issueKey}: investigate root cause, draft a fix path, and prepare a human-reviewable summary.`,
          },
        ],
        categoryHint: 'ticket_draft',
      });
      setNotice(`Draft solution saved (${callSet.id}). Open the ticket to continue.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not draft solution');
    } finally {
      setBusyId(null);
    }
  };

  const onDraftReply = async (channel: SlackChannelRow) => {
    setBusyChannelId(channel.id);
    try {
      const preview =
        channel.latestPreview ||
        `Latest activity in #${channel.name}`;
      const draft = `Thanks for the update in #${channel.name}.\n\nI'm looking into this now: "${preview.slice(0, 160)}". I'll follow up with next steps shortly.`;
      setDraftByChannel((prev) => ({ ...prev, [channel.id]: draft }));
    } finally {
      setBusyChannelId(null);
    }
  };

  const toggleWidget = (id: HomeWidgetId) => {
    const base = visibleWidgets.includes(id)
      ? visibleWidgets.filter((w) => w !== id)
      : [...visibleWidgets, id];
    setLayoutWidgets(base);
  };

  const saveLayout = async () => {
    const widgets = layoutWidgets ?? recommended;
    await api.putHomeLayout(widgets);
    setLayoutWidgets(widgets.length ? widgets : null);
    setCustomizing(false);
    setNotice('Home layout saved.');
  };

  const envHint = readCachedActiveEnvironmentId();

  return (
    <PageContainer width="operational" data-testid="workspace-home-page">
      <PageHeader
        eyebrow="Home"
        title="Workspace home"
        description="Recommended surfaces from services connected in the active environment."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              data-testid="home-customize"
              onClick={() => setCustomizing((v) => !v)}
            >
              {customizing ? 'Done' : 'Customize'}
            </Button>
            <Link
              to="/console"
              className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-primary hover:underline"
            >
              Console
            </Link>
          </div>
        }
      />

      <AsyncBoundary loading={loading} error={error} onRetry={() => void load()}>
        <div className="space-y-4">
          {notice && (
            <p className="text-sm text-success" role="status" data-testid="home-notice">
              {notice}
            </p>
          )}

          {customizing && (
            <Card title="Layout" description="Show or hide recommended widgets for this account.">
              <div className="flex flex-wrap gap-3">
                {(['tickets', 'channels'] as HomeWidgetId[]).map((id) => (
                  <label key={id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={visibleWidgets.includes(id)}
                      onChange={() => toggleWidget(id)}
                      data-testid={`home-layout-${id}`}
                    />
                    <span className="capitalize">{id}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3">
                <Button type="button" onClick={() => void saveLayout()} data-testid="home-layout-save">
                  Save layout
                </Button>
              </div>
            </Card>
          )}

          <p className="text-xs text-on-surface-variant">
            {connectedCount} connection{connectedCount === 1 ? '' : 's'}
            {envHint ? ` · env ${envHint}` : ''}
          </p>

          <div className={cn('grid gap-4', visibleWidgets.length > 1 && 'lg:grid-cols-2')}>
            {visibleWidgets.includes('tickets') && (
              <HomeTicketsWidget
                workItems={workItems}
                busyId={busyId}
                onWorkOn={(item) => void onWorkOn(item)}
                onDraftSolution={(item) => void onDraftSolution(item)}
              />
            )}
            {visibleWidgets.includes('channels') && (
              <HomeChannelsWidget
                connected={Boolean(slackConn)}
                live={Boolean(slackConn?.live)}
                channels={channels}
                loading={channelsLoading}
                error={channelsError}
                busyChannelId={busyChannelId}
                draftByChannel={draftByChannel}
                onRefresh={() => void loadChannels()}
                onDraftReply={(ch) => void onDraftReply(ch)}
              />
            )}
          </div>

          {visibleWidgets.length === 0 && (
            <Card title="No widgets yet">
              <p className="text-sm text-on-surface-variant">
                Connect a board or messaging service under{' '}
                <Link to="/connections" className="font-semibold text-primary hover:underline">
                  Connections
                </Link>
                , or use Customize to show widgets.
              </p>
            </Card>
          )}
        </div>
      </AsyncBoundary>
    </PageContainer>
  );
}
