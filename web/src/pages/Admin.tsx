import { FormEvent, useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { api } from '@shared/api';
import type { UserSecuritySettings } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import { AsyncBoundary, Button, Card, Field, PageContainer, PageHeader, StatusBadge } from '../components/ui';
import { roleDisplay, timeAgo } from '../lib/format';

export default function Admin() {
  const me = useAsync(() => api.me(), []);
  const [settings, setSettings] = useState<UserSecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passkeyName, setPasskeyName] = useState('');
  const [accessKeyName, setAccessKeyName] = useState('');
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSecuritySettings();
      setSettings(res.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load security settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const patch = async (body: Parameters<typeof api.updateSecuritySettings>[0]) => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await api.updateSecuritySettings(body);
      setSettings(res.settings);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const onRegisterPasskey = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      const res = await api.registerPasskey({ name: passkeyName });
      setSettings(res.settings);
      setPasskeyName('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not register passkey');
    } finally {
      setBusy(false);
    }
  };

  const onCreateAccessKey = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setActionError(null);
    setNewSecret(null);
    try {
      const res = await api.createAccessKey({ name: accessKeyName });
      setSettings(res.settings);
      setNewSecret(res.secret);
      setAccessKeyName('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not create access key');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer width="form" className="flex flex-col gap-4" data-testid="admin-page">
      <PageHeader
        eyebrow="Account"
        title="Security"
        description="Two-factor authentication, passkeys, and platform access keys for this account."
      />

      <AsyncBoundary
        loading={me.loading || loading}
        error={me.error ?? error}
        loadingLabel="Loading security…"
        onRetry={() => void load()}
      >
        {me.data && (
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
            data-testid="security-account-strip"
          >
            <span className="text-on-surface-variant">
              Org <span className="font-mono font-medium text-on-surface">{me.data.user.tenantId}</span>
            </span>
            <span className="hidden text-outline-variant sm:inline" aria-hidden="true">
              ·
            </span>
            <span className="min-w-0 truncate text-on-surface">
              {me.data.user.displayName}
              <span className="text-on-surface-variant"> · {me.data.user.email}</span>
            </span>
            <StatusBadge status={me.data.user.isWorkspaceOwner ? 'success' : 'info'} label={me.data.user.isWorkspaceOwner ? 'Workspace owner' : roleDisplay(me.data.user.roleId ?? 'member')} />
          </div>
        )}

        {settings && (
          <div className="space-y-4">
            <Card
              title="Two-factor authentication"
              description="Require a second factor when signing in. Sandbox stores the preference; live TOTP/SMS enrollment ships with IdP wiring."
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 text-sm">
                  <Smartphone size={18} className="mt-0.5 shrink-0 text-on-surface-variant" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-on-surface">
                      {settings.twoFactorEnabled ? '2FA enabled' : '2FA off'}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {settings.twoFactorRequired
                        ? 'Required on next sign-in for this account.'
                        : 'Optional until you mark it required.'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={settings.twoFactorEnabled ? 'secondary' : 'primary'}
                    loading={busy}
                    data-testid="security-2fa-toggle"
                    onClick={() =>
                      void patch({
                        twoFactorEnabled: !settings.twoFactorEnabled,
                        twoFactorRequired: settings.twoFactorEnabled
                          ? false
                          : settings.twoFactorRequired,
                      })
                    }
                  >
                    {settings.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    loading={busy}
                    disabled={!settings.twoFactorEnabled}
                    data-testid="security-2fa-require"
                    onClick={() => void patch({ twoFactorRequired: !settings.twoFactorRequired })}
                  >
                    {settings.twoFactorRequired ? 'Stop requiring' : 'Require at sign-in'}
                  </Button>
                </div>
              </div>
            </Card>

            <Card
              title="Passkeys"
              description="Hardware or platform authenticators for passwordless sign-in. Registration is sandboxed until WebAuthn is connected."
            >
              <label className="mb-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.passkeysEnabled}
                  disabled={busy}
                  onChange={(e) => void patch({ passkeysEnabled: e.target.checked })}
                  data-testid="security-passkeys-enabled"
                />
                Allow passkeys on this account
              </label>

              {settings.passkeys.length === 0 ? (
                <p className="mb-3 text-sm text-on-surface-variant">No passkeys registered.</p>
              ) : (
                <ul className="mb-3 divide-y divide-outline-variant" data-testid="security-passkey-list">
                  {settings.passkeys.map((pk) => (
                    <li key={pk.id} className="flex items-center gap-2 py-2 text-sm">
                      <ShieldCheck size={16} className="shrink-0 text-on-surface-variant" aria-hidden="true" />
                      <span className="min-w-0 flex-1 font-medium text-on-surface">{pk.name}</span>
                      <span className="text-xs text-on-surface-variant">
                        Added {timeAgo(pk.createdAt)}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void api.revokePasskey(pk.id).then((r) => setSettings(r.settings))
                        }
                        data-testid={`security-passkey-revoke-${pk.id}`}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <form
                onSubmit={onRegisterPasskey}
                className="flex flex-col gap-2 border-t border-outline-variant pt-3 sm:flex-row sm:items-end"
              >
                <Field
                  label="Device name"
                  className="min-w-0 flex-1"
                  required
                  value={passkeyName}
                  onChange={(e) => setPasskeyName(e.target.value)}
                  placeholder="MacBook Touch ID"
                  disabled={!settings.passkeysEnabled || busy}
                  data-testid="security-passkey-name"
                />
                <Button
                  type="submit"
                  loading={busy}
                  disabled={!settings.passkeysEnabled}
                  data-testid="security-passkey-register"
                >
                  Register passkey
                </Button>
              </form>
            </Card>

            <Card
              title="Platform access keys"
              description="Machine credentials for API and automation. Secrets are shown once — store them in your vault."
            >
              {settings.accessKeys.length === 0 ? (
                <p className="mb-3 text-sm text-on-surface-variant">No access keys yet.</p>
              ) : (
                <ul className="mb-3 divide-y divide-outline-variant" data-testid="security-access-key-list">
                  {settings.accessKeys.map((key) => (
                    <li key={key.id} className="flex items-center gap-2 py-2 text-sm">
                      <KeyRound size={16} className="shrink-0 text-on-surface-variant" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-on-surface">{key.name}</span>
                        <span className="ml-2 font-mono text-xs text-on-surface-variant">
                          {key.prefix}
                        </span>
                      </span>
                      {key.revokedAt ? (
                        <StatusBadge status="neutral" label="Revoked" />
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            void api.revokeAccessKey(key.id).then((r) => setSettings(r.settings))
                          }
                          data-testid={`security-access-key-revoke-${key.id}`}
                        >
                          Revoke
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {newSecret && (
                <div
                  className="mb-3 rounded-lg border border-butter-container bg-butter-container/40 p-3 text-sm"
                  data-testid="security-access-key-secret"
                  role="status"
                >
                  <p className="font-semibold text-on-butter-container">Copy this secret now</p>
                  <p className="mt-1 break-all font-mono text-xs text-on-surface">{newSecret}</p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-2"
                    onClick={() => setNewSecret(null)}
                  >
                    I’ve stored it
                  </Button>
                </div>
              )}

              <form
                onSubmit={onCreateAccessKey}
                className="flex flex-col gap-2 border-t border-outline-variant pt-3 sm:flex-row sm:items-end"
              >
                <Field
                  label="Key name"
                  className="min-w-0 flex-1"
                  required
                  value={accessKeyName}
                  onChange={(e) => setAccessKeyName(e.target.value)}
                  placeholder="CI pipeline"
                  disabled={busy}
                  data-testid="security-access-key-name"
                />
                <Button type="submit" loading={busy} data-testid="security-access-key-create">
                  Create access key
                </Button>
              </form>
            </Card>

            {actionError && (
              <p className="text-sm text-error" role="alert" data-testid="security-error">
                {actionError}
              </p>
            )}
          </div>
        )}
      </AsyncBoundary>
    </PageContainer>
  );
}
