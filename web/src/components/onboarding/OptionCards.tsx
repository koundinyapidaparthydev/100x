import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export type OptionCardItem = {
  id: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
};

type BaseProps = {
  label: string;
  hint?: string;
  options: OptionCardItem[];
  testId: string;
  columns?: 2 | 3 | 4;
  /** Compact rows for laptop viewports — title (+ optional short icon), no tall cards. */
  density?: 'comfortable' | 'compact';
};

export type SingleOptionCardsProps = BaseProps & {
  mode?: 'single';
  selected?: string;
  onSelect: (id: string) => void;
};

export type MultiOptionCardsProps = BaseProps & {
  mode: 'multi';
  selected?: string[];
  onToggle: (id: string) => void;
};

export type OptionCardsProps = SingleOptionCardsProps | MultiOptionCardsProps;

export function OptionCards(props: OptionCardsProps) {
  const { label, hint, options, testId, columns = 2, density = 'compact' } = props;
  const multi = props.mode === 'multi';
  const compact = density === 'compact';

  return (
    <fieldset data-testid={testId} className="min-w-0">
      <legend className="text-sm font-semibold text-on-surface">{label}</legend>
      {hint ? <p className="mt-0.5 text-[11px] leading-4 text-on-surface-variant">{hint}</p> : null}
      <div
        className={cn(
          'mt-2 grid gap-1.5',
          columns === 4 && 'grid-cols-2 lg:grid-cols-4',
          columns === 3 && 'grid-cols-2 sm:grid-cols-3',
          columns === 2 && 'grid-cols-2',
        )}
      >
        {options.map((opt) => {
          const Icon = opt.icon;
          const isOn = multi
            ? (props.selected ?? []).includes(opt.id)
            : props.selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={isOn}
              title={opt.description}
              onClick={() => {
                if (multi) props.onToggle(opt.id);
                else props.onSelect(opt.id);
              }}
              className={cn(
                'flex text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                compact
                  ? 'min-h-10 items-center gap-2 rounded-lg border px-2.5 py-2'
                  : 'min-h-[5.5rem] flex-col items-start gap-2 rounded-card border p-4',
                isOn
                  ? 'border-primary bg-primary-container/80 shadow-sm'
                  : 'border-outline-variant/70 bg-surface hover:border-primary/35 hover:bg-surface-container',
              )}
            >
              {Icon ? (
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center justify-center rounded-md',
                    compact ? 'size-7' : 'size-9 rounded-lg',
                    isOn ? 'bg-primary text-on-primary' : 'bg-surface-container text-primary',
                  )}
                >
                  <Icon size={compact ? 14 : 18} aria-hidden="true" />
                </span>
              ) : null}
              <span className="min-w-0 flex-1">
                <span className={cn('block font-semibold text-on-surface', compact ? 'text-xs' : 'text-sm')}>
                  {opt.title}
                </span>
                {!compact && opt.description ? (
                  <span className="mt-1 block text-xs leading-5 text-on-surface-variant">
                    {opt.description}
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  'shrink-0',
                  multi
                    ? cn(
                        'inline-flex size-4 items-center justify-center rounded border text-[10px] font-bold',
                        isOn
                          ? 'border-primary bg-primary text-on-primary'
                          : 'border-outline-variant text-transparent',
                      )
                    : cn(
                        'size-3.5 rounded-full border-2',
                        isOn ? 'border-primary bg-primary' : 'border-outline-variant',
                      ),
                )}
                aria-hidden="true"
              >
                {multi ? '✓' : null}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
