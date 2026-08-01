import type { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-fixed-dim',
  secondary: 'border border-outline-variant bg-surface text-on-surface hover:bg-surface-container',
  quiet: 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
  danger: 'bg-error text-on-error hover:bg-error/90',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
