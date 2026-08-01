import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { getStatusDefinition, type StatusTone } from './status';

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-surface-container text-on-surface-variant',
  info: 'bg-mint-container text-on-mint-container',
  success: 'bg-success-container text-on-success-container',
  warning: 'bg-butter-container text-on-butter-container',
  danger: 'bg-blush-container text-on-blush-container',
};

export interface StatusBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  status: string;
  label?: string;
  tone?: StatusTone;
}

export function StatusBadge({ status, label, tone, className, ...props }: StatusBadgeProps) {
  const definition = getStatusDefinition(status);
  return (
    <span
      {...props}
      className={cn(
        'inline-flex min-h-6 items-center rounded-chip px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone ?? definition.tone],
        className,
      )}
    >
      {label ?? definition.label}
    </span>
  );
}
