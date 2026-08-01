import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  inputClassName?: string;
}

export function Field({
  label,
  hint,
  error,
  id: providedId,
  className,
  inputClassName,
  ...props
}: FieldProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const supportingId = hint || error ? `${id}-supporting` : undefined;
  return (
    <label htmlFor={id} className={cn('block text-sm font-medium text-on-surface', className)}>
      <span>{label}</span>
      <input
        {...props}
        id={id}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={supportingId}
        className={cn(
          'mt-1.5 min-h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-surface-container disabled:text-on-surface-variant',
          error && 'border-error focus:border-error focus:ring-error/15',
          inputClassName,
        )}
      />
      {(error || hint) && (
        <span id={supportingId} className={cn('mt-1.5 block text-xs', error ? 'text-error' : 'text-on-surface-variant')}>
          {error ?? hint}
        </span>
      )}
    </label>
  );
}
