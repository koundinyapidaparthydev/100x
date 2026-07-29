import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-md py-3xl text-on-surface-variant">
      <Loader2 size={28} className="animate-spin text-tertiary" />
      <span className="font-body-sm text-body-sm">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-md py-3xl text-center bg-surface-container border border-outline-variant rounded-xl px-lg">
      <div className="w-12 h-12 rounded-full bg-error-container/40 border border-error/40 flex items-center justify-center">
        <AlertTriangle size={22} className="text-error" />
      </div>
      <div>
        <p className="font-headline-sm text-headline-sm text-on-surface">Unable to load data</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs max-w-md">
          {message} — is the backend running on port 4000?
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-md py-sm rounded bg-tertiary text-on-tertiary font-label-md text-label-md flex items-center gap-xs hover:bg-tertiary-fixed transition-colors font-bold"
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
    <div className="flex flex-col items-center justify-center gap-md py-3xl text-center bg-surface-container border border-outline-variant rounded-xl px-lg">
      <div className="w-12 h-12 rounded-full bg-surface-variant border border-outline-variant flex items-center justify-center text-on-surface-variant">
        {icon ?? <Inbox size={22} />}
      </div>
      <p className="font-headline-sm text-headline-sm text-on-surface">{title}</p>
      {body && <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">{body}</p>}
    </div>
  );
}
