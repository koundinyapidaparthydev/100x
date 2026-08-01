import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type TagTone = 'neutral' | 'primary' | 'mint' | 'butter' | 'blush' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<TagTone, string> = {
  neutral: 'bg-surface-container text-on-surface-variant',
  primary: 'bg-primary-container text-on-primary-container',
  mint: 'bg-mint-container text-on-mint-container',
  butter: 'bg-butter-container text-on-butter-container',
  blush: 'bg-blush-container text-on-blush-container',
  success: 'bg-success-container text-on-success-container',
  warning: 'bg-warning-container text-on-warning-container',
  danger: 'bg-error-container text-on-error-container',
};

export interface TagProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  tone?: TagTone;
  children: ReactNode;
}

/** Static label pill for work-item labels and metadata. Use Chip for filters. */
export function Tag({ tone = 'neutral', className, children, ...props }: TagProps) {
  return (
    <span
      {...props}
      className={cn(
        'inline-flex max-w-full items-center truncate rounded-chip px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
