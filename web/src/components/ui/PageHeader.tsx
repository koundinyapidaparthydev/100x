import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className="grid w-full grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-[72ch] text-sm leading-6 text-on-surface-variant sm:text-base">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>}
    </header>
  );
}
