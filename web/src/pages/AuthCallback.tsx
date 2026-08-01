import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@shared/api';
import { writeDemoSession } from '../lib/session';
import { Button } from '../components/ui';

/**
 * Landing page after Okta redirects back through the backend callback.
 * Expects ?exchange=...&intent=login|signup
 */
export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const exchange = params.get('exchange');
    const intent = params.get('intent') === 'signup' ? 'signup' : 'login';
    if (!exchange) {
      setError('Missing Okta exchange code. Try signing in again.');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { session } = await api.oktaExchange(exchange);
        if (cancelled) return;
        writeDemoSession({
          token: session.token,
          id: session.user.id,
          role: session.user.role,
          surface: session.user.surface,
        });
        navigate(intent === 'signup' ? '/onboarding' : '/projects', { replace: true });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Okta sign-in failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, params]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-on-surface">
        <h1 className="text-xl font-semibold">Couldn’t finish Okta sign-in</h1>
        <p className="max-w-md text-center text-sm text-on-surface-variant" data-testid="okta-callback-error">
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
      data-testid="okta-callback-pending"
    >
      <p className="text-sm font-semibold">Completing Okta sign-in…</p>
      <p className="text-xs text-on-surface-variant">Exchanging your secure session</p>
    </div>
  );
}
