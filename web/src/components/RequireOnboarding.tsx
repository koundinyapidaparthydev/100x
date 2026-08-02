import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { hydrateOnboardingFromServer, isOnboardingComplete } from '../lib/onboardingStorage';

/**
 * Blocks the authenticated app shell until this user finishes onboarding.
 * Syncs completion from the API so a fresh device / cleared localStorage still
 * respects server truth (and incomplete users cannot skip into /admin, etc.).
 */
export default function RequireOnboarding({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(() => isOnboardingComplete());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const done = await hydrateOnboardingFromServer();
      if (!cancelled) {
        setComplete(done);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background text-sm text-on-surface-variant"
        data-testid="onboarding-gate-pending"
      >
        Checking workspace setup…
      </div>
    );
  }

  if (!complete) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
