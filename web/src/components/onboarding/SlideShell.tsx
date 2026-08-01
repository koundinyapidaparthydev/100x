import type { ReactNode } from 'react';
import { Button } from '../ui';

export type SlideShellProps = {
  step: number;
  totalSteps: number;
  title: string;
  description?: string;
  children: ReactNode;
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  busy?: boolean;
};

export function SlideShell({
  step,
  totalSteps,
  title,
  description,
  children,
  onBack,
  onContinue,
  continueLabel = 'Continue',
  continueDisabled,
  busy,
}: SlideShellProps) {
  return (
    <div
      className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col"
      data-testid="onboarding-slide"
    >
      <div className="shrink-0">
        <div className="mb-3 flex items-center gap-1.5" aria-label={`Step ${step} of ${totalSteps}`}>
          {Array.from({ length: totalSteps }, (_, i) => {
            const n = i + 1;
            const active = n === step;
            const done = n < step;
            return (
              <div
                key={n}
                className={
                  active
                    ? 'h-1 flex-1 rounded-full bg-primary transition-colors'
                    : done
                      ? 'h-1 flex-1 rounded-full bg-primary/45 transition-colors'
                      : 'h-1 flex-1 rounded-full bg-outline-variant transition-colors'
                }
                aria-current={active ? 'step' : undefined}
              />
            );
          })}
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
          Step {step} of {totalSteps}
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-on-surface sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-[70ch] text-xs leading-5 text-on-surface-variant sm:text-sm sm:leading-5">
            {description}
          </p>
        ) : null}
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
        <div className="space-y-3 pb-2">{children}</div>
      </div>

      <div className="sticky bottom-0 z-10 mt-auto flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-outline-variant/70 bg-background/95 py-3 backdrop-blur-sm">
        {onBack ? (
          <Button type="button" variant="quiet" onClick={onBack} disabled={busy}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="button"
          onClick={onContinue}
          disabled={continueDisabled}
          loading={busy}
          data-testid="onboarding-continue"
        >
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}
