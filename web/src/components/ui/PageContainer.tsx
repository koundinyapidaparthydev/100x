import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type PageContainerWidth = 'operational' | 'form' | 'detail';

export interface PageContainerProps<T extends ElementType = 'div'> {
  as?: T;
  children: ReactNode;
  className?: string;
  width?: PageContainerWidth;
}

const WIDTH_CLASSES: Record<PageContainerWidth, string> = {
  operational: 'max-w-[1280px]',
  form: 'max-w-[1040px]',
  detail: 'max-w-[1280px]',
};

export function PageContainer<T extends ElementType = 'div'>({
  as,
  children,
  className,
  width = 'operational',
  ...props
}: PageContainerProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof PageContainerProps<T>>) {
  const Component = as ?? 'div';
  return (
    <Component
      className={cn('mx-auto w-full min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8', WIDTH_CLASSES[width], className)}
      {...props}
    >
      {children}
    </Component>
  );
}
