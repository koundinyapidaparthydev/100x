import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isOnboardingComplete } from '../lib/onboardingStorage';

/**
 * Blocks the authenticated app shell until workspace onboarding is finished.
 * Onboarding itself is outside this gate.
 */
export default function RequireOnboarding({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (!isOnboardingComplete()) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
