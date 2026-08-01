import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '@shared/api';
import { readDemoSession, writeDemoSession } from '../lib/session';
import { AuthSplit, WorkspaceAuthForm, type DemoRoleId } from '../components/landing';

export default function Signup() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Snapshot only on mount so writing the session during signup does not bounce to /projects
  // before navigate('/onboarding') lands.
  const [hadSessionOnMount] = useState(() => Boolean(readDemoSession()));

  if (hadSessionOnMount) {
    return <Navigate to="/projects" replace />;
  }

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
      navigate('/onboarding');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign up failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthSplit
      testId="signup-page"
      eyebrow="Create workspace"
      title="Start as the workspace owner — then connect your stack."
      body="You create the workspace, run Free or Enterprise onboarding, and invite delivery leads and contributors afterward."
      bullets={[
        'Owner controls policy, PII, models, and connections',
        'Team seats handle triage and review day to day',
        'Continue with Okta when OIDC is configured on the backend',
      ]}
    >
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">
          Create your AplifyAI workspace
        </h2>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant sm:text-base">
          Register as the workspace owner, then complete a short onboarding. No card required.
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
