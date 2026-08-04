import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@shared/api';
import type { FederatedExchangeResponse } from '@shared/types';
import { demoSeatFromUser, writeDemoSession } from '../lib/session';
import { hydrateOnboardingFromServer, resolvePostAuthLanding } from '../lib/onboardingStorage';
import { Button } from '../components/ui';

/** Dedupes Strict Mode double-mount so the one-time exchange isn't raced twice. */
const exchangeInflight = new Map<string, Promise<FederatedExchangeResponse>>();

function federatedExchangeOnce(exchange: string): Promise<FederatedExchangeResponse> {
  let pending = exchangeInflight.get(exchange);
  if (!pending) {
    pending = api.federatedExchange(exchange).catch((err) => {
      exchangeInflight.delete(exchange);
      throw err;
    });
    exchangeInflight.set(exchange, pending);
  }
  return pending;
}

/**
 * Landing page after any federated IdP redirects back through the backend callback.
 * Expects ?exchange=...&intent=login|signup&provider=...
 */
export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const provider = params.get('provider') ?? 'SSO';
  const exchange = params.get('exchange');
  const intent = params.get('intent') === 'signup' ? 'signup' : 'login';

  useEffect(() => {
    if (!exchange) {
      setError('Missing sign-in exchange code. Try signing in again.');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { session } = await federatedExchangeOnce(exchange);
        if (cancelled) return;
        writeDemoSession({
          token: session.token,
          id: session.user.id,
          role: demoSeatFromUser(session.user),
          surface: session.user.surface,
        });
        const done = await hydrateOnboardingFromServer();
        let setupComplete = session.user.workspaceSetupComplete === true;
        if (!setupComplete) {
          try {
            const setup = await api.getWorkspaceSetup();
            setupComplete = setup.complete;
          } catch {
            setupComplete = false;
          }
        }
        if (!setupComplete) {
          navigate('/auth/workspace', { replace: true });
          return;
        }
        // Signup always onboards; login only skips when THIS user completed on the server.
        if (intent === 'signup' || !done) {
          navigate('/onboarding', { replace: true });
          return;
        }
        navigate(await resolvePostAuthLanding(), { replace: true });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Sign-in failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exchange, intent, navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-on-surface">
        <h1 className="text-xl font-semibold">Couldn’t finish {provider} sign-in</h1>
        <p className="max-w-md text-center text-sm text-on-surface-variant" data-testid="sso-callback-error">
          {error}
        </p>
        <Link to="/login">
          <Button variant="primary">Back to sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background text-on-surface"
      data-testid="sso-callback-pending"
    >
      <p className="text-sm font-semibold">Completing {provider} sign-in…</p>
      <p className="text-xs text-on-surface-variant">Exchanging your secure session</p>
    </div>
  );
}
