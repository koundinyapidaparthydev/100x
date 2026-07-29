import { useEffect, useState } from 'react';
import { Cloud as CloudIcon, Globe, KeyRound, Lock, LockOpen, ShieldCheck } from 'lucide-react';
import { api } from '@shared/api';
import type { CloudProvider, Policy } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import Chip from '../components/Chip';
import { cloudModeDisplay, humanize, providerDisplay } from '../lib/format';

const inputClass =
  'w-full h-9 bg-surface-variant border border-outline-variant/50 rounded text-body-sm text-on-surface px-3 outline-none focus:border-outline-variant disabled:opacity-60';

const PROVIDERS: CloudProvider[] = ['aws', 'azure', 'gcp', 'private'];
const MODES: Policy['cloud']['mode'][] = ['public_managed', 'private_vpc', 'customer_cloud'];

export default function Cloud() {
  const { data: policies, loading, error, reload } = useAsync(() => api.listPolicies(), []);
  const policy = policies?.[0] ?? null;

  const [provider, setProvider] = useState<CloudProvider>('azure');
  const [mode, setMode] = useState<Policy['cloud']['mode']>('private_vpc');
  const [region, setRegion] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!policy) return;
    setProvider(policy.cloud.provider);
    setMode(policy.cloud.mode);
    setRegion(policy.cloud.region);
  }, [policy]);

  const locked = policy?.locks.cloud ?? false;

  const save = async () => {
    if (!policy) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.updatePolicy(policy.id, {
        cloud: { provider, mode, region },
      });
      setMessage({ tone: 'ok', text: 'Cloud configuration saved.' });
      reload();
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-container-max mx-auto p-margin flex flex-col gap-xl">
      <div className="flex justify-between items-end gap-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-semibold text-on-surface">Cloud & Security</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-sm max-w-2xl">
            Where AI jobs execute — provider, deployment mode, and region are set by policy and locked by the founder.
          </p>
        </div>
        {policy && (
          <div className="flex items-center gap-md shrink-0">
            {message && (
              <span className={`font-body-sm text-body-sm ${message.tone === 'ok' ? 'text-tertiary' : 'text-error'}`}>
                {message.text}
              </span>
            )}
            <button
              type="button"
              disabled={saving || locked}
              onClick={save}
              className="px-md py-sm rounded bg-tertiary text-on-tertiary font-label-md text-label-md font-bold hover:bg-tertiary-fixed transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {loading && <LoadingState label="Loading cloud configuration…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && !policy && (
        <EmptyState
          icon={<CloudIcon size={22} />}
          title="No cloud configuration"
          body="Create a policy to choose the cloud provider, deployment mode, and region for AI execution."
        />
      )}

      {!loading && !error && policy && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
          <div className="lg:col-span-2 glass-panel rounded-xl p-lg flex flex-col justify-between gap-xl">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-sm">
                <CloudIcon size={32} className="text-tertiary" />
                <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">
                  {providerDisplay(provider)}
                </h3>
              </div>
              <div className="px-sm py-1 bg-tertiary/10 border border-tertiary/30 text-tertiary font-label-sm text-label-sm rounded uppercase tracking-wider flex items-center gap-xs">
                <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
                {region || policy.cloud.region}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
              <label className="bg-surface-container-high p-md rounded border border-outline-variant flex flex-col gap-sm">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-xs">
                  <CloudIcon size={14} /> Provider
                </span>
                <select
                  className={inputClass}
                  value={provider}
                  disabled={locked}
                  onChange={(e) => setProvider(e.target.value as CloudProvider)}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {humanize(p)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="bg-surface-container-high p-md rounded border border-outline-variant flex flex-col gap-sm">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-xs">
                  <Globe size={14} /> Region
                </span>
                <input
                  className={inputClass}
                  value={region}
                  disabled={locked}
                  onChange={(e) => setRegion(e.target.value)}
                />
              </label>
              <label className="bg-surface-container-high p-md rounded border border-outline-variant flex flex-col gap-sm">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-xs">
                  <KeyRound size={14} /> Mode
                </span>
                <select
                  className={inputClass}
                  value={mode}
                  disabled={locked}
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
          </div>

          <div className="glass-panel rounded-xl p-lg flex flex-col gap-md">
            <div className="flex items-center gap-sm mb-xs">
              <ShieldCheck size={24} className="text-on-surface" />
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Execution Governance</h3>
            </div>

            <div className="flex justify-between items-center p-sm rounded bg-surface-container-highest border border-outline-variant/30">
              <span className="font-body-sm text-body-sm text-on-surface">Cloud lock</span>
              {locked ? (
                <Chip tone="error">
                  <Lock size={12} /> Locked
                </Chip>
              ) : (
                <Chip tone="surface">
                  <LockOpen size={12} /> Editable
                </Chip>
              )}
            </div>
            <div className="flex justify-between items-center p-sm rounded bg-surface-container-highest border border-outline-variant/30">
              <span className="font-body-sm text-body-sm text-on-surface">Code override</span>
              <Chip
                tone={
                  policy.platform.codeOverrideMode === 'forbidden'
                    ? 'error'
                    : policy.platform.codeOverrideMode === 'allowed_with_audit'
                      ? 'warning'
                      : 'tertiary'
                }
              >
                {humanize(policy.platform.codeOverrideMode)}
              </Chip>
            </div>
            <div className="flex justify-between items-center p-sm rounded bg-surface-container-highest border border-outline-variant/30">
              <span className="font-body-sm text-body-sm text-on-surface">Budget exhaustion</span>
              <Chip tone={policy.tokenBudget.onExhaustion === 'block' ? 'error' : 'warning'}>
                {humanize(policy.tokenBudget.onExhaustion)}
              </Chip>
            </div>
            <div className="flex justify-between items-center p-sm rounded bg-surface-container-highest border border-outline-variant/30">
              <span className="font-body-sm text-body-sm text-on-surface">Security level</span>
              <Chip tone="primary">{humanize(policy.securityLevel)}</Chip>
            </div>

            <p className="font-body-sm text-body-sm text-on-surface-variant mt-auto pt-md border-t border-outline-variant">
              Every job records its cloud execution (provider, mode, region) on the work item for audit.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
