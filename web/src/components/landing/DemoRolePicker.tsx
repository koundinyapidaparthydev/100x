import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api';
import type { FederatedAuthProvider, FederatedProviderStatus } from '@shared/types';
import { Button, Field } from '../ui';

export type DemoRoleId = 'manager' | 'root' | 'engineer';

type AuthMode = 'owner' | 'member';

/** Default demo identity — full manage rights so every screen is editable. */
export const DEMO_CONTINUE_IDENTITY: DemoRoleId = 'root';

const DEMO_WORKSPACE = 'acme-delivery';

const MEMBER_SEATS: { id: DemoRoleId; title: string; description: string }[] = [
  {
    id: 'manager',
    title: 'Delivery lead',
    description: 'Triage work, assign people, and record approval decisions.',
  },
  {
    id: 'engineer',
    title: 'Contributor',
    description: 'Read-only access to work items, AI drafts, and evidence.',
  },
];

const PROVIDER_BUTTON: Record<
  FederatedAuthProvider,
  { label: string; testId: string }
> = {
  google: {
    label: 'Continue with Google',
    testId: 'google',
  },
  apple: {
    label: 'Continue with Apple',
    testId: 'apple',
  },
  okta: {
    label: 'Continue with Okta',
    testId: 'okta',
  },
  entra: {
    label: 'Continue with Microsoft',
    testId: 'entra',
  },
  google_workspace: {
    label: 'Continue with Google Workspace',
    testId: 'google-workspace',
  },
};

/**
 * AplifyAI sign-in: one-click demo entry + Workspace owner vs Team member seats.
 * Maps to demo identities root / manager / engineer under the hood.
 */
export function WorkspaceAuthForm({
  busy,
  error,
  onSelect,
  testIdPrefix,
  switchLabel,
  switchTo,
  variant,
}: {
  busy: boolean;
  error: string | null;
  onSelect: (id: DemoRoleId) => void;
  testIdPrefix: 'login' | 'signup';
  switchLabel: string;
  switchTo: string;
  /** signup = create workspace as owner; login = owner or member */
  variant: 'login' | 'signup';
}) {
  const [mode, setMode] = useState<AuthMode>(variant === 'signup' ? 'owner' : 'member');
  const [ownerEmail, setOwnerEmail] = useState('root@acme.demo');
  const [workspace, setWorkspace] = useState(DEMO_WORKSPACE);
  const [memberSeat, setMemberSeat] = useState<DemoRoleId>('manager');
  const [providers, setProviders] = useState<FederatedProviderStatus[]>([]);
  const [providersChecked, setProvidersChecked] = useState(false);
  const [showSeatPicker, setShowSeatPicker] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api
      .authProvidersStatus()
      .then((res) => {
        if (!cancelled) {
          setProviders(res.providers);
          setProvidersChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Keep providersChecked false so buttons stay usable if status is unreachable
          // (e.g. backend restarting) — click still hits /auth/:provider/start.
          setProviders([]);
          setProvidersChecked(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byProvider = useMemo(() => {
    const map = new Map<FederatedAuthProvider, FederatedProviderStatus>();
    for (const p of providers) map.set(p.provider, p);
    return map;
  }, [providers]);

  const social: FederatedAuthProvider[] = ['google', 'apple'];
  const enterprise: FederatedAuthProvider[] = ['okta', 'entra', 'google_workspace'];

  const activeIdentity: DemoRoleId = mode === 'owner' ? 'root' : memberSeat;
  const switchHrefLabel = switchTo.includes('signup')
    ? 'Create a workspace'
    : switchTo.includes('login')
      ? 'Sign in'
      : 'Continue';

  const seatSelected = useMemo(
    () => MEMBER_SEATS.find((u) => u.id === memberSeat) ?? MEMBER_SEATS[0]!,
    [memberSeat],
  );

  const submit = () => {
    onSelect(mode === 'owner' ? 'root' : memberSeat);
  };

  const startProvider = (provider: FederatedAuthProvider) => {
    window.location.assign(
      api.authStartUrl(provider, variant === 'signup' ? 'signup' : 'login', 'web'),
    );
  };

  const renderProviderButton = (provider: FederatedAuthProvider) => {
    const meta = PROVIDER_BUTTON[provider];
    const status = byProvider.get(provider);
    const knownDisabled = providersChecked && status?.enabled === false;
    return (
      <Button
        key={provider}
        variant="secondary"
        className="w-full"
        disabled={busy || knownDisabled}
        data-testid={`${testIdPrefix}-${meta.testId}`}
        title={
          knownDisabled
            ? `${meta.label} needs IdP credentials on the backend`
            : `Continue with ${status?.label ?? meta.label}`
        }
        onClick={() => startProvider(provider)}
      >
        {meta.label}
      </Button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/25 bg-primary-container/40 p-4">
        <p className="text-sm font-semibold text-on-surface">Building-stage demo</p>
        <p className="mt-1 text-xs leading-5 text-on-surface-variant">
          Jump in as the workspace owner with full access — view and change projects, policies,
          approvals, and connections. Switch seats anytime from the top bar.
        </p>
        <Button
          variant="primary"
          className="mt-3 w-full"
          disabled={busy}
          loading={busy}
          data-testid={`${testIdPrefix}-continue-demo`}
          onClick={() => onSelect(DEMO_CONTINUE_IDENTITY)}
        >
          <Sparkles size={16} aria-hidden="true" />
          Continue as demo <ArrowRight size={16} />
        </Button>
      </div>

      <div className="relative flex items-center gap-3">
        <div className="h-px flex-1 bg-outline-variant" />
        <button
          type="button"
          className="text-xs font-semibold uppercase tracking-[0.06em] text-on-surface-variant hover:text-on-surface"
          data-testid={`${testIdPrefix}-toggle-seats`}
          aria-expanded={showSeatPicker}
          onClick={() => setShowSeatPicker((open) => !open)}
        >
          {showSeatPicker ? 'Hide seat options' : 'Or choose a specific seat'}
        </button>
        <div className="h-px flex-1 bg-outline-variant" />
      </div>

      {showSeatPicker && (
        <>
          {variant === 'login' && (
            <div
              className="grid grid-cols-2 gap-1 rounded-lg bg-surface-container p-1"
              role="tablist"
              aria-label="Sign-in type"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'owner'}
                data-testid={`${testIdPrefix}-mode-owner`}
                className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                  mode === 'owner'
                    ? 'bg-surface text-on-surface shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                onClick={() => setMode('owner')}
              >
                Root
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'member'}
                data-testid={`${testIdPrefix}-mode-member`}
                className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                  mode === 'member'
                    ? 'bg-surface text-on-surface shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                onClick={() => setMode('member')}
              >
                Team member
              </button>
            </div>
          )}

          {mode === 'owner' ? (
            <div className="space-y-4">
              <p className="text-sm text-on-surface-variant">
                {variant === 'signup'
                  ? 'Create the workspace as the owner. You control policy, connections, and who can join.'
                  : 'Sign in as the workspace owner — full control of governance and connections.'}
              </p>
              <Field
                label="Owner email"
                id={`${testIdPrefix}-owner-email`}
                data-testid={`${testIdPrefix}-owner-email`}
                type="email"
                autoComplete="username"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="you@company.com"
                hint="Demo session only — password and MFA are not required here."
              />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-on-surface-variant">
                Join an existing workspace with a team seat for day-to-day triage and review.
              </p>
              <Field
                label="Workspace"
                id={`${testIdPrefix}-workspace`}
                data-testid={`${testIdPrefix}-workspace`}
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder={DEMO_WORKSPACE}
                hint="Workspace slug or invite code (demo accepts any value)."
              />
              <div>
                <p className="mb-2 text-sm font-medium text-on-surface">Your seat</p>
                <div className="space-y-2">
                  {MEMBER_SEATS.map((seat) => {
                    const selected = memberSeat === seat.id;
                    return (
                      <button
                        key={seat.id}
                        type="button"
                        data-testid={`${testIdPrefix}-member-${seat.id}`}
                        onClick={() => setMemberSeat(seat.id)}
                        className={`flex w-full flex-col rounded-lg border px-3 py-3 text-left transition-colors ${
                          selected
                            ? 'border-primary bg-primary-container/60'
                            : 'border-outline-variant bg-surface hover:bg-surface-container'
                        }`}
                      >
                        <span className="text-sm font-semibold text-on-surface">{seat.title}</span>
                        <span className="mt-0.5 text-xs text-on-surface-variant">{seat.description}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">
                  Selected: {seatSelected.title} · workspace{' '}
                  <span className="font-mono">{workspace || DEMO_WORKSPACE}</span>
                </p>
              </div>
            </div>
          )}

          <Button
            variant="secondary"
            className="w-full"
            disabled={busy}
            loading={busy}
            data-testid={`${testIdPrefix}-${activeIdentity}`}
            onClick={submit}
          >
            {variant === 'signup' ? 'Create workspace' : 'Sign in'} <ArrowRight size={16} />
          </Button>
        </>
      )}

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-outline-variant" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-surface px-2 text-xs text-on-surface-variant">Or continue with</span>
        </div>
      </div>

      <div className="space-y-2">{social.map(renderProviderButton)}</div>

      <div className="space-y-2 pt-1">
        <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
          Enterprise SSO
        </p>
        {enterprise.map(renderProviderButton)}
      </div>

      {error && (
        <p className="text-sm text-error" data-testid={`${testIdPrefix}-error`} role="alert">
          {error}
        </p>
      )}

      <p className="pt-1 text-center text-sm text-on-surface-variant">
        {switchLabel}{' '}
        <Link to={switchTo} className="font-semibold text-primary hover:underline">
          {switchHrefLabel}
        </Link>
      </p>
    </div>
  );
}

/** @deprecated Prefer WorkspaceAuthForm */
export const AwsConsoleAuth = WorkspaceAuthForm;
export const DemoRolePicker = WorkspaceAuthForm;
export const DEMO_ROLES = [
  { id: 'root' as const, title: 'Root' },
  { id: 'manager' as const, title: 'Delivery lead' },
  { id: 'engineer' as const, title: 'Contributor' },
];
