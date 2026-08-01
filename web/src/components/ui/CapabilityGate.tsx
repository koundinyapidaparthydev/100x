import type { ReactNode } from 'react';

export interface CapabilityGateProps {
  allowed: boolean;
  children: ReactNode;
  fallback?: ReactNode;
  reason?: string;
}

export function CapabilityGate({ allowed, children, fallback = null, reason }: CapabilityGateProps) {
  if (allowed) return children;
  if (fallback) return fallback;
  if (!reason) return null;
  return (
    <p className="rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface-variant" role="note">
      {reason}
    </p>
  );
}
