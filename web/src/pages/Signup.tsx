import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@shared/api';
import { hydrateOnboardingFromServer, postAuthPath } from '../lib/onboardingStorage';
import { applyDemoSessionToApi, readDemoSession, writeDemoSession } from '../lib/session';
import { AuthSplit, WorkspaceAuthForm, type DemoRoleId } from '../components/landing';

export default function Signup() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(() => Boolean(readDemoSession()));

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
      if (!cancelled) {
        navigate(postAuthPath(), { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleSignup = async (identity: DemoRoleId) => {
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
      await hydrateOnboardingFromServer();
      // New workspaces always collect onboarding answers first.
      navigate('/onboarding');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign up failed');
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
      testId="signup-page"
      eyebrow="Create workspace"
      title="Start as the workspace owner — then connect your stack."
      body="You create the workspace, run Free or Enterprise onboarding, and invite delivery leads and contributors afterward."
      bullets={[
        'Start free for full editable access',
        'Owner controls policy, PII, models, and connections',
        'Switch seats anytime from the top bar',
      ]}
    >
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">
          Create your AplifyAI workspace
        </h2>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant sm:text-base">
          Start free for full access, or register as the owner and run onboarding. No card required.
        </p>
        <div className="mt-8">
          <WorkspaceAuthForm
            variant="signup"
            busy={busy}
            error={error}
            onSelect={(id) => void handleSignup(id)}
            testIdPrefix="signup"
            switchLabel="Already have a workspace?"
            switchTo="/login"
          />
        </div>
      </div>
    </AuthSplit>
  );
}
