import { BellOff, Brain, CheckSquare, Clock, Shield, ShieldAlert } from 'lucide-react';
import { api } from '@shared/api';
import type { NotificationKind } from '@shared/types';
import { cn } from '../lib/utils';
import { useAsync } from '../lib/useAsync';
import { timeAgo } from '../lib/format';
import { LoadingState, ErrorState, EmptyState } from '../components/States';

const KIND_META: Record<NotificationKind, { icon: typeof Brain; iconClass: string }> = {
  ai_ready: { icon: Brain, iconClass: 'bg-primary-container text-on-primary-container' },
  pii_block: { icon: ShieldAlert, iconClass: 'bg-warning-container text-on-warning-container' },
  approval: { icon: CheckSquare, iconClass: 'bg-tertiary-container text-on-tertiary-container' },
  system: { icon: Clock, iconClass: 'bg-surface-container-high text-on-surface' },
  security: { icon: Shield, iconClass: 'bg-surface-container-high text-on-surface' },
};

export function Notifications() {
  const { data, error, loading, retry } = useAsync(() => api.listNotifications());

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingState label="Loading notifications…" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <ErrorState error={error} onRetry={retry} />
      </div>
    );
  }

  // Unread first, then newest.
  const sorted = [...data].sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="flex flex-col gap-2 px-4 py-4 max-w-md mx-auto w-full">
      {sorted.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="No notifications"
          body="AI drafts ready for review, PII blocks, and approval requests will show up here."
        />
      ) : (
        sorted.map((notification) => {
          const meta = KIND_META[notification.kind];
          const Icon = meta.icon;
          return (
            <div
              key={notification.id}
              className={cn(
                'bg-surface-container-lowest border p-4 rounded-xl flex items-start gap-3 relative',
                notification.read ? 'border-outline-variant opacity-70' : 'border-outline',
              )}
            >
              {!notification.read && (
                <div className="w-1.5 h-1.5 rounded-full bg-tertiary absolute top-4 left-2" />
              )}
              <div
                className={cn(
                  'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ml-2',
                  meta.iconClass,
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2 mb-0.5">
                  <p className="font-sans text-base font-semibold text-on-surface truncate">
                    {notification.title}
                  </p>
                  <span className="font-mono text-[10px] text-on-surface-variant whitespace-nowrap">
                    {timeAgo(notification.createdAt)}
                  </span>
                </div>
                <p className="font-body-sm text-on-surface-variant">{notification.body}</p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
