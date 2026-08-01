import { useEffect, useMemo, useState } from 'react';
import { Cloud as CloudIcon, Globe, Lock } from 'lucide-react';
import { api } from '@shared/api';
import type { CloudProvider, Policy } from '@shared/types';
import GovernanceNav from '../components/GovernanceNav';
import { useAsync } from '../lib/useAsync';
import { AsyncBoundary, Card, Field, PageContainer, PageHeader, SaveBar, StatusBadge } from '../components/ui';
import { cloudModeDisplay, humanize, providerDisplay } from '../lib/format';
import { readDemoSession } from '../lib/session';

const PROVIDERS: CloudProvider[] = ['aws', 'azure', 'gcp', 'private'];
const MODES: Policy['cloud']['mode'][] = ['public_managed', 'private_vpc', 'customer_cloud'];
const selectClass =
  'mt-1.5 min-h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-surface-container disabled:text-on-surface-variant';

export default function Cloud() {
  const canManage = ['founder', 'manager'].includes(readDemoSession()?.role ?? '');
  const { data: policies, loading, error, reload } = useAsync(() => api.listPolicies(), []);
  const policy = policies?.find((item) => item.scope === 'org') ?? policies?.[0] ?? null;

  const [provider, setProvider] = useState<CloudProvider>('azure');
  const [mode, setMode] = useState<Policy['cloud']['mode']>('private_vpc');
  const [region, setRegion] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const resetDraft = (source: Policy) => {
    setProvider(source.cloud.provider);
    setMode(source.cloud.mode);
    setRegion(source.cloud.region);
  };

  useEffect(() => {
    if (policy) resetDraft(policy);
  }, [policy]);

  const locked = policy?.locks.cloud ?? false;
  const readOnly = locked || !canManage;
  const dirty = useMemo(
    () => Boolean(policy && (provider !== policy.cloud.provider || mode !== policy.cloud.mode || region !== policy.cloud.region)),
    [mode, policy, provider, region],
  );

  const save = async () => {
    if (!policy || readOnly) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.updatePolicy(policy.id, {
        cloud: { provider, mode, region },
      });
      setMessage('Cloud runtime settings saved.');
      reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Cloud runtime settings could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer width="form" className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Governance / Policy workspace / Runtime"
        title="Cloud runtime"
        description="Set the provider, deployment mode, and region recorded on future AI jobs."
        actions={locked ? <StatusBadge status="blocked" label="Editing locked by policy" /> : undefined}
      />

      <GovernanceNav />
      {!canManage && (
        <p className="rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
          Your role can review cloud runtime settings but cannot change them.
        </p>
      )}

      <AsyncBoundary
        loading={loading}
        error={error}
        empty={!loading && !error && !policy}
        loadingLabel="Loading cloud runtime…"
        emptyTitle="No policy configured"
        emptyBody="Cloud runtime settings become available when an organization policy exists."
        onRetry={reload}
      >
        {policy && (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(17rem,0.6fr)]">
              <Card
                title="Execution configuration"
                description={readOnly ? 'These fields are read-only for the current role or policy.' : 'Changes affect future jobs after you save.'}
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <label className="block text-sm font-medium text-on-surface">
                    Provider
                <select
                  className={selectClass}
                  value={provider}
                  disabled={readOnly}
                  onChange={(e) => setProvider(e.target.value as CloudProvider)}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {humanize(p)}
                    </option>
                  ))}
                </select>
                  </label>
                  <Field
                  label="Region"
                  value={region}
                  disabled={readOnly}
                  onChange={(e) => setRegion(e.target.value)}
                />
                  <label className="block text-sm font-medium text-on-surface">
                    Deployment mode
                <select
                  className={selectClass}
                  value={mode}
                  disabled={readOnly}
                  onChange={(e) => setMode(e.target.value as Policy['cloud']['mode'])}
                >
                  {MODES.map((m) => (
                    <option key={m} value={m}>
                      {cloudModeDisplay(m)}
                    </option>
                  ))}
                </select>
                  </label>
                </div>
              </Card>

              <Card title="Saved runtime" actions={<CloudIcon size={20} className="text-on-surface-variant" />}>
                <dl className="space-y-3 text-sm">
                  <div><dt className="text-on-surface-variant">Provider</dt><dd className="font-medium text-on-surface">{providerDisplay(policy.cloud.provider)}</dd></div>
                  <div><dt className="text-on-surface-variant">Region</dt><dd className="flex items-center gap-1.5 text-on-surface"><Globe size={14} /> {policy.cloud.region}</dd></div>
                  <div><dt className="text-on-surface-variant">Mode</dt><dd className="text-on-surface">{cloudModeDisplay(policy.cloud.mode)}</dd></div>
                  <div className="flex items-center gap-2 border-t border-outline-variant pt-3 text-xs text-on-surface-variant">
                    <Lock size={14} /> {locked ? 'Cloud setting lock is enabled.' : 'Cloud settings are editable.'}
                  </div>
                </dl>
              </Card>
            </div>

            <Card title="What this setting means" className="bg-surface-container-low">
              <p className="text-sm leading-6 text-on-surface-variant">
                The selected provider, mode, and region are passed into job records and runtime configuration.
                This page does not verify network isolation, account ownership, deployment health, or the physical location of a provider's infrastructure.
              </p>
            </Card>
            {message && <p className="text-sm text-on-surface-variant">{message}</p>}
            <SaveBar
              dirty={dirty && !readOnly}
              saving={saving}
              message="Cloud runtime has unsaved changes."
              onSave={() => void save()}
              onDiscard={() => resetDraft(policy)}
            />
          </>
        )}
      </AsyncBoundary>
    </PageContainer>
  );
}
