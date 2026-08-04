import { Link } from 'react-router-dom';
import { Button, Card } from '../ui';

export type SlackChannelRow = {
  id: string;
  name: string;
  topic?: string;
  latestPreview?: string;
};

export type HomeChannelsWidgetProps = {
  connected: boolean;
  live: boolean;
  channels: SlackChannelRow[];
  loading: boolean;
  error: string | null;
  busyChannelId: string | null;
  draftByChannel: Record<string, string>;
  onRefresh: () => void;
  onDraftReply: (channel: SlackChannelRow) => void;
};

export function HomeChannelsWidget({
  connected,
  live,
  channels,
  loading,
  error,
  busyChannelId,
  draftByChannel,
  onRefresh,
  onDraftReply,
}: HomeChannelsWidgetProps) {
  return (
    <Card
      title="Channels"
      description="Slack channels from the active environment connection."
      data-testid="home-channels-widget"
      actions={
        connected ? (
          <Button
            type="button"
            variant="secondary"
            className="min-h-8 px-3 py-1.5 text-xs"
            disabled={loading}
            onClick={onRefresh}
            data-testid="home-channels-refresh"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        ) : undefined
      }
    >
      {!connected ? (
        <p className="text-sm text-on-surface-variant">
          Connect Slack for this environment under{' '}
          <Link to="/connections" className="font-semibold text-primary hover:underline">
            Connections
          </Link>{' '}
          to list channels here.
        </p>
      ) : error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : channels.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          {loading
            ? 'Loading channels…'
            : live
              ? 'No channels returned. Check Slack OAuth scopes or try Refresh.'
              : 'Slack is connected in stub mode. Authorize + verify for live channel lists.'}
        </p>
      ) : (
        <ul className="divide-y divide-outline-variant">
          {channels.map((ch) => (
            <li key={ch.id} className="py-3" data-testid={`home-channel-${ch.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface">#{ch.name}</p>
                  {ch.topic && (
                    <p className="mt-0.5 text-xs text-on-surface-variant">{ch.topic}</p>
                  )}
                  {ch.latestPreview && (
                    <p className="mt-1 text-sm text-on-surface-variant line-clamp-2">
                      {ch.latestPreview}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-8 px-3 py-1.5 text-xs"
                  disabled={busyChannelId === ch.id}
                  data-testid={`home-channel-draft-${ch.id}`}
                  onClick={() => onDraftReply(ch)}
                >
                  Draft reply
                </Button>
              </div>
              {draftByChannel[ch.id] && (
                <div
                  className="mt-2 rounded-lg border border-outline-variant bg-surface-container-low p-2.5 text-sm"
                  data-testid={`home-channel-draft-body-${ch.id}`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                    Suggested reply (confirm before posting)
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-on-surface">{draftByChannel[ch.id]}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
