import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type CardTone = 'default' | 'mint' | 'butter' | 'blush';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  hierarchy?: 'primary' | 'secondary' | 'quiet';
  /** Pastel attention surface; overrides hierarchy fill when not default. */
  tone?: CardTone;
}

const HIERARCHY_CLASSES = {
  primary: 'border-outline-variant/80 bg-surface shadow-card',
  secondary: 'border-outline-variant/60 bg-surface-container-low shadow-xs',
  quiet: 'border-transparent bg-transparent shadow-none',
};

const TONE_CLASSES: Record<Exclude<CardTone, 'default'>, string> = {
  mint: 'border-mint/20 bg-mint-container text-on-mint-container shadow-xs',
  butter: 'border-butter/20 bg-butter-container text-on-butter-container shadow-xs',
  blush: 'border-blush/20 bg-blush-container text-on-blush-container shadow-xs',
};

export function Card({
  title,
  description,
  actions,
  hierarchy = 'primary',
  tone = 'default',
  className,
  children,
  ...props
}: CardProps) {
  const surfaceClasses = tone === 'default' ? HIERARCHY_CLASSES[hierarchy] : TONE_CLASSES[tone];

  return (
    <section
      {...props}
      className={cn('min-w-0 rounded-card border p-4 sm:p-5', surfaceClasses, className)}
    >
      {(title || description || actions) && (
        <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3 sm:flex-nowrap sm:gap-4">
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-base font-semibold text-on-surface">{title}</h2>}
            {description && <p className="mt-1 text-sm text-on-surface-variant">{description}</p>}
          </div>
          {actions && <div className="flex max-w-full shrink-0 flex-wrap">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
