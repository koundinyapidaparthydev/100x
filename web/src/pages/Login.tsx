import { useState } from 'react';
import { ShieldCheck, Lock, ArrowRight } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '@shared/api';
import { readDemoSession, writeDemoSession } from '../lib/session';

export default function Login() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (readDemoSession()) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (identity: 'founder' | 'manager' | 'engineer') => {
    setBusy(true);
    setError(null);
    try {
      const { session } = await api.login({ identity, surface: 'web' });
      writeDemoSession({
        token: session.token,
        id: session.user.id,
        role: session.user.role,
        surface: 'web',
      });
      navigate('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="bg-surface-dim text-on-surface font-body-md min-h-screen flex flex-col relative mesh-background"
      data-testid="login-page"
    >
      <main className="flex-grow flex flex-col items-center justify-center relative z-10 px-margin">
        <div className="flex flex-col items-center text-center max-w-[800px] w-full">
          <div className="flex items-center gap-sm mb-2xl">
            <ShieldCheck className="text-tertiary" size={32} fill="currentColor" />
            <span className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              AplifyAI
            </span>
          </div>

          <h1 className="font-display-lg text-display-lg text-on-surface mb-lg leading-tight">
            Autonomous Jira Delegation.
          </h1>

          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[600px] mb-3xl">
            AI-first project management engineered for high-stakes enterprise scale. Secure, precise,
            and fully accountable.
          </p>

          <div className="flex flex-col sm:flex-row gap-md w-full max-w-md">
            <button
              type="button"
              disabled={busy}
              data-testid="login-manager"
              onClick={() => void handleLogin('manager')}
              className="flex-1 bg-tertiary hover:bg-tertiary-fixed text-on-tertiary font-label-md text-label-md px-xl py-[16px] rounded-lg transition-all duration-200 flex items-center justify-center gap-sm disabled:opacity-50"
            >
              <Lock size={18} />
              <span>{busy ? 'Signing in…' : 'Manager login'}</span>
              <ArrowRight size={18} />
            </button>
            <button
              type="button"
              disabled={busy}
              data-testid="login-founder"
              onClick={() => void handleLogin('founder')}
              className="flex-1 border border-outline-variant text-on-surface font-label-md text-label-md px-xl py-[16px] rounded-lg transition-all duration-200 disabled:opacity-50"
            >
              Founder login
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            data-testid="login-engineer"
            onClick={() => void handleLogin('engineer')}
            className="mt-md font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface underline-offset-2 hover:underline disabled:opacity-50"
          >
            Engineer login (read-only demo)
          </button>
          {error && (
            <p className="font-label-sm text-error mt-md" data-testid="login-error">
              {error}
            </p>
          )}
          <p className="font-label-sm text-label-sm text-on-surface-variant mt-md">
            Demo sessions issue Bearer tokens · real SSO/OIDC replaces this in later H1
          </p>
        </div>
      </main>

      <footer className="bg-surface-container-lowest border-t border-outline-variant flex justify-between items-center px-xl py-sm w-full z-10">
        <div className="flex items-center gap-sm">
          <Lock size={16} className="text-tertiary animate-pulse" fill="currentColor" />
          <span className="font-label-sm text-label-sm text-tertiary uppercase tracking-wider">
            Encryption Active | Session auth | PII Redaction: Enabled
          </span>
        </div>
      </footer>
    </div>
  );
}
