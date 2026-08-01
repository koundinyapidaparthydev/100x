import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-md py-3xl text-on-surface-variant" role="status">
      <Loader2 size={24} className="animate-spin text-primary" />
      <span className="font-body-sm text-body-sm">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-md rounded-xl border border-outline-variant bg-surface px-lg py-3xl text-center" role="alert">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-error-container">
        <AlertTriangle size={22} className="text-error" />
      </div>
      <div>
        <p className="font-headline-sm text-headline-sm text-on-surface">Unable to load data</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs max-w-md">
          {message}
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-xs rounded-lg bg-primary px-md py-sm font-label-md text-label-md font-bold text-on-primary transition-colors hover:bg-primary-fixed-dim"
        >
          <RefreshCw size={16} />
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, body, icon }: { title: string; body?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-md rounded-xl border border-outline-variant bg-surface px-lg py-3xl text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        {icon ?? <Inbox size={22} />}
      </div>
      <p className="font-headline-sm text-headline-sm text-on-surface">{title}</p>
      {body && <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">{body}</p>}
    </div>
  );
}
