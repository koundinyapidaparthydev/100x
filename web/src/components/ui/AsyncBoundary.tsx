import type { ReactNode } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../AsyncStates';

export interface AsyncBoundaryProps {
  loading: boolean;
  error?: Error | string | null;
  empty?: boolean;
  loadingLabel?: string;
  emptyTitle?: string;
  emptyBody?: string;
  onRetry?: () => void;
  children: ReactNode;
}

export function AsyncBoundary({
  loading,
  error,
  empty = false,
  loadingLabel,
  emptyTitle = 'Nothing here yet',
  emptyBody,
  onRetry,
  children,
}: AsyncBoundaryProps) {
  if (loading) return <LoadingState label={loadingLabel} />;
  if (error) return <ErrorState message={typeof error === 'string' ? error : error.message} onRetry={onRetry} />;
  if (empty) return <EmptyState title={emptyTitle} body={emptyBody} />;
  return children;
}
