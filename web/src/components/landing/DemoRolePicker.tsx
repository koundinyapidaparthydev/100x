import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api';
import { Button, Field } from '../ui';

export type DemoRoleId = 'manager' | 'founder' | 'engineer';

type AuthMode = 'owner' | 'member';

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

/**
 * AplifyAI sign-in: Workspace owner vs Team member (scoped seat).
 * Maps to demo identities founder / manager / engineer under the hood.
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
  const [ownerEmail, setOwnerEmail] = useState('founder@acme.demo');
  const [workspace, setWorkspace] = useState(DEMO_WORKSPACE);
  const [memberSeat, setMemberSeat] = useState<DemoRoleId>('manager');
  const [oktaEnabled, setOktaEnabled] = useState(false);
  const [oktaChecked, setOktaChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api
      .oktaStatus()
      .then((status) => {
        if (!cancelled) {
          setOktaEnabled(status.enabled);
          setOktaChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOktaEnabled(false);
          setOktaChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeIdentity: DemoRoleId = mode === 'owner' ? 'founder' : memberSeat;
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
    onSelect(mode === 'owner' ? 'founder' : memberSeat);
  };

  return (
    <div className="space-y-5">
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
            Workspace owner
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
        variant="primary"
        className="w-full"
        disabled={busy}
        loading={busy}
        data-testid={`${testIdPrefix}-${activeIdentity}`}
        onClick={submit}
      >
        {variant === 'signup' ? 'Create workspace' : 'Sign in'} <ArrowRight size={16} />
      </Button>

      <Button
        variant="secondary"
        className="w-full"
        disabled={busy || (oktaChecked && !oktaEnabled)}
        data-testid={`${testIdPrefix}-okta`}
        title={
          oktaEnabled
            ? 'Continue with your Okta organization'
            : 'Set OKTA_ISSUER, OKTA_CLIENT_ID, OKTA_CLIENT_SECRET, OKTA_REDIRECT_URI on the backend'
        }
        onClick={() => {
          window.location.assign(api.oktaStartUrl(variant === 'signup' ? 'signup' : 'login'));
        }}
      >
        {oktaChecked && !oktaEnabled ? 'Continue with Okta — not configured' : 'Continue with Okta'}
      </Button>
      {oktaChecked && !oktaEnabled && (
        <p className="text-xs text-on-surface-variant" data-testid={`${testIdPrefix}-okta-hint`}>
          Okta OIDC is implemented. Add issuer/client credentials to the backend env to enable this
          button.
        </p>
      )}

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
      <p className="text-xs text-on-surface-variant">
        Demo authentication only. Production identity and SSO are not configured here.
      </p>
    </div>
  );
}

/** @deprecated Prefer WorkspaceAuthForm */
export const AwsConsoleAuth = WorkspaceAuthForm;
export const DemoRolePicker = WorkspaceAuthForm;
export const DEMO_ROLES = [
  { id: 'founder' as const, title: 'Workspace owner' },
  { id: 'manager' as const, title: 'Delivery lead' },
  { id: 'engineer' as const, title: 'Contributor' },
];
