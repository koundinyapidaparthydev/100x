import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@shared/api';
import { applyDemoSessionToApi, readDemoSession, demoSeatFromUser, writeDemoSession } from '../lib/session';
import { hydrateOnboardingFromServer, resolvePostAuthLanding } from '../lib/onboardingStorage';
import { AuthSplit, WorkspaceAuthForm, type DemoRoleId } from '../components/landing';

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(() => Boolean(readDemoSession()));
  const [error, setError] = useState<string | null>(() =>
    params.get('sso_error') ||
      params.get('okta_error') ||
      params.get('entra_error') ||
      params.get('google_error') ||
      params.get('google_workspace_error') ||
      params.get('apple_error'),
  );

  useEffect(() => {
    const existing = readDemoSession();
    if (!existing) {
      setCheckingSession(false);
      return;
    }
    applyDemoSessionToApi(existing);
    let cancelled = false;
    void (async () => {
      await hydrateOnboardingFromServer();
      const dest = await resolvePostAuthLanding();
      if (!cancelled) {
        navigate(dest, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleLogin = async (identity: DemoRoleId) => {
    setBusy(true);
    setError(null);
    try {
      const { session } = await api.login({ identity, surface: 'web' });
      writeDemoSession({
        token: session.token,
        id: session.user.id,
        role: demoSeatFromUser(session.user),
        surface: 'web',
      });
      const done = await hydrateOnboardingFromServer();
      if (!done) {
        navigate('/onboarding');
        return;
      }
      navigate(await resolvePostAuthLanding());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-on-surface-variant">
        Checking workspace setup…
      </div>
    );
  }

  if (readDemoSession()) {
    return null;
  }

  return (
    <AuthSplit
      testId="login-page"
      eyebrow="Workspace access"
      title="Sign in as the owner — or join as a team member."
      body="Owners govern policy and connections. Delivery leads triage AI vs human. Contributors review drafts and evidence."
      bullets={[
        'Start free for full owner access',
        'Or pick a seat: delivery lead or contributor',
        'Switch seats anytime from the top bar',
      ]}
    >
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">
          Sign in to AplifyAI
        </h2>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant sm:text-base">
          Start free for full access, or pick a specific seat. No card required.
        </p>
        <div className="mt-8">
          <WorkspaceAuthForm
            variant="login"
            busy={busy}
            error={error}
            onSelect={(id) => void handleLogin(id)}
            testIdPrefix="login"
            switchLabel="Need a workspace?"
            switchTo="/signup"
          />
        </div>
      </div>
    </AuthSplit>
  );
}
