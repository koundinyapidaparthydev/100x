import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@shared/api';
import { readDemoSession, writeDemoSession } from '../lib/session';
import { AuthSplit, WorkspaceAuthForm, type DemoRoleId } from '../components/landing';

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() => params.get('okta_error'));

  if (readDemoSession()) {
    return <Navigate to="/projects" replace />;
  }

  const handleLogin = async (identity: DemoRoleId) => {
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
      navigate('/projects');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthSplit
      testId="login-page"
      eyebrow="Workspace access"
      title="Sign in as the owner — or join as a team member."
      body="Owners govern policy and connections. Delivery leads triage AI vs human. Contributors review drafts and evidence."
      bullets={[
        'Workspace owner: org policy, runtime, and connections',
        'Team seats: delivery lead or contributor',
        'Demo sessions — no card required',
      ]}
    >
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">
          Sign in to AplifyAI
        </h2>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant sm:text-base">
          Workspace owner or team member. No card required.
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
