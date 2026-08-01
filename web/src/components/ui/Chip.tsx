import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type ChipTone = 'neutral' | 'primary' | 'mint' | 'butter' | 'blush' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<ChipTone, string> = {
  neutral: 'border-outline-variant/70 bg-surface-container text-on-surface-variant',
  primary: 'border-primary/25 bg-primary-container text-on-primary-container',
  mint: 'border-mint/25 bg-mint-container text-on-mint-container',
  butter: 'border-butter/25 bg-butter-container text-on-butter-container',
  blush: 'border-blush/25 bg-blush-container text-on-blush-container',
  success: 'border-success/25 bg-success-container text-on-success-container',
  warning: 'border-warning/25 bg-warning-container text-on-warning-container',
  danger: 'border-error/25 bg-error-container text-on-error-container',
};

const SELECTED_CLASSES: Record<ChipTone, string> = {
  neutral: 'border-on-surface/30 bg-surface-container-highest text-on-surface',
  primary: 'border-primary bg-primary text-on-primary',
  mint: 'border-mint bg-mint text-white',
  butter: 'border-butter bg-butter text-white',
  blush: 'border-blush bg-blush text-white',
  success: 'border-success bg-success text-on-success',
  warning: 'border-warning bg-warning text-on-warning',
  danger: 'border-error bg-error text-on-error',
};

export function chipClassName({
  tone = 'neutral',
  selected = false,
  className,
}: {
  tone?: ChipTone;
  selected?: boolean;
  className?: string;
} = {}) {
  return cn(
    'inline-flex min-h-8 items-center gap-1.5 rounded-chip border px-3 py-1 text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-55',
    selected ? SELECTED_CLASSES[tone] : TONE_CLASSES[tone],
    className,
  );
}

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ChipTone;
  selected?: boolean;
  count?: number;
  children: ReactNode;
}

/** Interactive filter / toggle pill. Use Tag for static labels. */
export function Chip({
  tone = 'neutral',
  selected = false,
  count,
  className,
  children,
  type = 'button',
  ...props
}: ChipProps) {
  return (
    <button
      {...props}
      type={type}
      aria-pressed={selected}
      className={chipClassName({ tone, selected, className })}
    >
      <span>{children}</span>
      {typeof count === 'number' ? (
        <span
          className={cn(
            'inline-flex min-w-5 items-center justify-center rounded-chip px-1.5 text-xs font-semibold',
            selected ? 'bg-white/20' : 'bg-surface-bright/70 text-on-surface-variant',
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
