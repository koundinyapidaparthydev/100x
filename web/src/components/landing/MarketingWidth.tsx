import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { cn } from '../../lib/utils';

/** Shared marketing content width: ~92vw, capped at 90rem, with roomy horizontal padding. */
export const MARKETING_WIDTH_CLASS =
  'mx-auto w-full max-w-[min(92vw,90rem)] px-4 sm:px-6 lg:px-10';

export type MarketingWidthProps<T extends ElementType = 'div'> = {
  as?: T;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'>;

/**
 * Constrains marketing nav, footer, and page mains to the shared ~92vw / 90rem shell.
 * Pass `className` for layout extras (flex, gap, py). Use `as` to render `nav` / `main` / etc.
 */
export function MarketingWidth<T extends ElementType = 'div'>({
  as,
  children,
  className,
  ...props
}: MarketingWidthProps<T>) {
  const Component = as ?? 'div';
  return (
    <Component className={cn(MARKETING_WIDTH_CLASS, className)} {...props}>
      {children}
    </Component>
  );
}
