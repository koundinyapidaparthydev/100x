import { cn } from '../../lib/utils';

export const SPEED_OPTIONS = [3, 20, 40, 70, 100] as const;

export type SpeedMeterProps = {
  value?: number;
  onChange: (value: number) => void;
};

function nearestOption(value: number): number {
  return SPEED_OPTIONS.reduce((best, opt) =>
    Math.abs(opt - value) < Math.abs(best - value) ? opt : best,
  );
}

function toneLabel(value: number): string {
  if (value <= 3) return 'Steady gains';
  if (value <= 20) return 'Meaningful lift';
  if (value <= 40) return 'Aggressive lift';
  if (value <= 70) return 'Step-change';
  return 'Transformational';
}

export function SpeedMeter({ value, onChange }: SpeedMeterProps) {
  const hasValue = typeof value === 'number';
  const selected = hasValue ? nearestOption(value) : null;
  const selectedIndex =
    selected == null ? -1 : SPEED_OPTIONS.indexOf(selected as (typeof SPEED_OPTIONS)[number]);
  const pct = selectedIndex < 0 ? 0 : (selectedIndex / (SPEED_OPTIONS.length - 1)) * 100;

  return (
    <div
      data-testid="speed-meter"
      className="rounded-card border border-outline-variant/70 bg-surface-container-low p-4"
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            Expected speed-up
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-primary">
            {selected == null ? (
              <span className="text-on-surface-variant">—</span>
            ) : (
              <>
                {selected}
                <span className="text-lg text-primary/80">x</span>
              </>
            )}
          </p>
        </div>
        <p className="text-sm text-on-surface-variant">
          {selected == null ? 'Choose a target' : toneLabel(selected)}
        </p>
      </div>

      <div
        className="mt-5"
        role="radiogroup"
        aria-label="Speed-up multiplier"
        data-testid="speed-meter-input"
      >
        <div className="relative mx-3 h-8">
          <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-outline-variant/60">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="relative flex h-full items-center justify-between">
            {SPEED_OPTIONS.map((opt) => {
              const isOn = selected === opt;
              const isReached = selected != null && opt <= selected;
              return (
                <button
                  key={opt}
                  type="button"
                  role="radio"
                  aria-checked={isOn}
                  aria-label={`${opt}x speed-up`}
                  data-testid={`speed-meter-${opt}`}
                  onClick={() => onChange(opt)}
                  className={cn(
                    'relative z-10 flex size-5 items-center justify-center rounded-full border-2 transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    isOn
                      ? 'border-primary bg-primary shadow-sm scale-110'
                      : isReached
                        ? 'border-primary bg-primary'
                        : 'border-outline-variant bg-surface hover:border-primary/60',
                  )}
                >
                  {isOn ? <span className="size-1.5 rounded-full bg-white" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mx-0 flex justify-between">
          {SPEED_OPTIONS.map((opt) => {
            const isOn = selected === opt;
            return (
              <button
                key={`label-${opt}`}
                type="button"
                tabIndex={-1}
                onClick={() => onChange(opt)}
                className={cn(
                  'min-w-5 text-center text-xs font-semibold transition-colors',
                  isOn ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                {opt}x
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
