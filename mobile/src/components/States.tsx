import type { LucideIcon } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

/** Centered loading skeleton — pulsing surface blocks. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 animate-fade-in" role="status">
      <div className="w-full max-w-md flex flex-col gap-3">
        <div className="h-6 w-1/3 rounded bg-surface-container-high animate-pulse" />
        <div className="h-24 w-full rounded-xl bg-surface-container-low border border-outline-variant animate-pulse" />
        <div className="h-24 w-full rounded-xl bg-surface-container-low border border-outline-variant animate-pulse" />
      </div>
      <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">{label}</span>
    </div>
  );
}

/** Centered error state with retry. */
export function ErrorState({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center animate-fade-in">
      <div className="w-14 h-14 rounded-xl bg-error-container flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-on-error-container" />
      </div>
      <div>
        <h2 className="font-headline-sm text-on-surface mb-1">Couldn’t reach the server</h2>
        <p className="font-body-sm text-on-surface-variant max-w-xs">
          {error?.message ?? 'Something went wrong. Check that the backend is running on :4000.'}
        </p>
      </div>
      <button
        onClick={onRetry}
        className="h-11 px-6 rounded-lg bg-primary text-on-primary font-sans font-semibold text-sm active:scale-[0.98] transition-transform"
      >
        Retry
      </button>
    </div>
  );
}

/** Centered empty state. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 p-8 text-center animate-fade-in', className)}>
      <div className="w-14 h-14 rounded-xl bg-surface-container-high border border-outline-variant flex items-center justify-center">
        <Icon className="w-7 h-7 text-on-surface-variant" />
      </div>
      <div>
        <h2 className="font-headline-sm text-on-surface mb-1">{title}</h2>
        {body && <p className="font-body-sm text-on-surface-variant max-w-xs">{body}</p>}
      </div>
    </div>
  );
}
