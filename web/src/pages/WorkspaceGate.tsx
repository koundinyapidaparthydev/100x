import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@shared/api';
import { writeDemoSession } from '../lib/session';
import { hydrateOnboardingFromServer } from '../lib/onboardingStorage';
import { Button, Field } from '../components/ui';

/**
 * Post-Google company / primary-account gate.
 * Workspace creators keep Root locked; parent-company path waits for invite role.
 */
export default function WorkspaceGate() {
  const navigate = useNavigate();
  const [isPrimary, setIsPrimary] = useState(true);
  const [companyDomain, setCompanyDomain] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [belongsToParent, setBelongsToParent] = useState(false);
  const [parentDomain, setParentDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { session } = await api.putWorkspaceSetup({
        isPrimaryGoogleAccount: isPrimary,
        companyDomain: companyDomain.trim() || undefined,
        companyWebsite: companyWebsite.trim() || undefined,
        workEmail: workEmail.trim() || undefined,
        belongsToParentCompany: belongsToParent,
        parentCompanyDomain: parentDomain.trim() || undefined,
      });
      writeDemoSession({
        token: session.token,
        id: session.user.id,
        role: session.user.role,
        surface: session.user.surface,
      });
      const done = await hydrateOnboardingFromServer();
      navigate(done ? '/console' : '/onboarding', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save workspace setup');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-on-surface">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg space-y-6 rounded-2xl border border-outline-variant bg-surface p-6 shadow-card sm:p-8"
        data-testid="workspace-gate"
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            Workspace
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Set up your workspace</h1>
          <p className="text-sm text-on-surface-variant">
            Confirm your primary account and optional company identity before opening the console.
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
            className="mt-1"
            data-testid="workspace-primary-google"
          />
          <span>
            <span className="font-medium text-on-surface">This is my primary Google account</span>
            <span className="mt-0.5 block text-on-surface-variant">
              Use a different work email below if your company identity differs.
            </span>
          </span>
        </label>

        <Field label="Company domain" hint="Optional for solo workspaces — e.g. acme.com">
          <input
            value={companyDomain}
            onChange={(e) => setCompanyDomain(e.target.value)}
            placeholder="acme.com"
            data-testid="workspace-company-domain"
            className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </Field>

        <Field label="Company website" hint="Optional">
          <input
            value={companyWebsite}
            onChange={(e) => setCompanyWebsite(e.target.value)}
            placeholder="https://acme.com"
            data-testid="workspace-company-website"
            className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </Field>

        <Field label="Work email" hint="Optional — linked if different from Google">
          <input
            type="email"
            value={workEmail}
            onChange={(e) => setWorkEmail(e.target.value)}
            placeholder="you@acme.com"
            data-testid="workspace-work-email"
            className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </Field>

        <label className="flex items-start gap-3 text-sm opacity-90">
          <input type="checkbox" checked disabled className="mt-1" data-testid="workspace-root-locked" />
          <span>
            <span className="font-medium text-on-surface">I am creating this workspace as Root</span>
            <span className="mt-0.5 block text-on-surface-variant">
              Locked for workspace creators. Unlocks only if you join a parent company below.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={belongsToParent}
            onChange={(e) => setBelongsToParent(e.target.checked)}
            className="mt-1"
            data-testid="workspace-parent-company"
          />
          <span>
            <span className="font-medium text-on-surface">I belong to a parent company</span>
            <span className="mt-0.5 block text-on-surface-variant">
              Skip Root and join with the role allocated by that org (invite / domain claim).
            </span>
          </span>
        </label>

        {belongsToParent && (
          <Field label="Parent company domain" hint="Required when joining a parent org">
            <input
              value={parentDomain}
              onChange={(e) => setParentDomain(e.target.value)}
              placeholder="parent.com"
              required
              data-testid="workspace-parent-domain"
              className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </Field>
        )}

        {error && (
          <p className="text-sm text-error" data-testid="workspace-gate-error">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" loading={busy} data-testid="workspace-gate-continue">
          Continue
        </Button>
      </form>
    </div>
  );
}
