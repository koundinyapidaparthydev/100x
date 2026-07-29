import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export type ChipTone = 'tertiary' | 'primary' | 'secondary' | 'error' | 'warning' | 'surface';

const TONE_CLASSES: Record<ChipTone, string> = {
  tertiary: 'bg-tertiary/10 border-tertiary/30 text-tertiary',
  primary: 'bg-primary/10 border-primary/30 text-primary',
  secondary: 'bg-secondary/10 border-secondary/30 text-secondary',
  error: 'bg-error/10 border-error/30 text-error',
  warning: 'bg-warning/10 border-warning/30 text-warning',
  surface: 'bg-surface-variant/50 border-outline-variant/50 text-on-surface-variant',
};

interface ChipProps {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
  /** Show a pulsing live dot before the label. */
  pulse?: boolean;
  /** React internal key (stripped at runtime). */
  key?: string;
}

export default function Chip({ tone = 'surface', children, className, pulse }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-xs px-2 py-0.5 rounded border font-label-sm text-label-sm uppercase tracking-wider',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
      {children}
    </span>
  );
}
