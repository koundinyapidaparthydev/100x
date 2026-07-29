import { useEffect, useState } from 'react';
import { Brain, Lock } from 'lucide-react';
import { api } from '@shared/api';
import type { Policy } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import Chip from '../components/Chip';
import { humanize } from '../lib/format';

const inputClass =
  'w-full h-9 bg-surface-variant border border-outline-variant/50 rounded text-body-sm text-on-surface px-3 outline-none focus:border-outline-variant disabled:opacity-60';

const PROVIDERS = ['openai', 'anthropic', 'azure_openai', 'bedrock', 'custom'];
const RUNTIMES = ['cursor', 'claude_code', 'codex', 'custom'];
const OVERRIDE_MODES = ['forbidden', 'allowed_with_audit', 'allowed'] as const;

export default function Models() {
  const { data: policies, loading, error, reload } = useAsync(() => api.listPolicies(), []);
  const policy = policies?.[0] ?? null;

  const [provider, setProvider] = useState('');
  const [modelId, setModelId] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [runtime, setRuntime] = useState('');
  const [codeOverrideMode, setCodeOverrideMode] = useState<Policy['platform']['codeOverrideMode']>('forbidden');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!policy) return;
    setProvider(policy.model.provider);
    setModelId(policy.model.modelId);
    setEndpoint(policy.model.endpoint ?? '');
    setRuntime(policy.platform.runtime);
    setCodeOverrideMode(policy.platform.codeOverrideMode);
  }, [policy]);

  const locked = policy?.locks.models ?? false;

  const save = async () => {
    if (!policy) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.updatePolicy(policy.id, {
        model: {
          provider,
          modelId,
          ...(endpoint.trim() ? { endpoint: endpoint.trim() } : {}),
        },
        platform: {
          runtime,
          codeOverrideMode,
        },
      });
      setMessage({ tone: 'ok', text: 'Model configuration saved.' });
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
          <h2 className="font-headline-lg text-headline-lg font-semibold text-on-surface">Models & Platforms</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-sm max-w-2xl">
            Configure and manage AI providers, API keys, and model-specific parameters.
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

      {loading && <LoadingState label="Loading model configuration…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && !policy && (
        <EmptyState
          icon={<Brain size={22} />}
          title="No model configured"
          body="Create a policy to select the default model and platform runtime."
        />
      )}

      {!loading && !error && policy && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-md">
            <div className="flex justify-between items-center border-b border-outline-variant pb-md">
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 rounded bg-surface-container-lowest border border-outline-variant flex items-center justify-center">
                  <Brain className="text-on-surface" size={24} />
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">{humanize(provider || policy.model.provider)}</h3>
                  <div className="flex items-center gap-xs mt-xs">
                    <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
                    <span className="font-label-sm text-label-sm text-tertiary uppercase">Connected</span>
                  </div>
                </div>
              </div>
              {locked && (
                <Chip tone="error">
                  <Lock size={12} /> Locked
                </Chip>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              <label className="flex flex-col gap-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Provider</span>
                <select
                  className={inputClass}
                  value={provider}
                  disabled={locked}
                  onChange={(e) => setProvider(e.target.value)}
                >
                  {[...new Set([provider, ...PROVIDERS].filter(Boolean))].map((p) => (
                    <option key={p} value={p}>
                      {humanize(p)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Default Model</span>
                <input
                  className={inputClass}
                  value={modelId}
                  disabled={locked}
                  onChange={(e) => setModelId(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-xs sm:col-span-2">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Endpoint (optional)</span>
                <input
                  className={inputClass}
                  value={endpoint}
                  disabled={locked}
                  placeholder="Provider default"
                  onChange={(e) => setEndpoint(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Platform Runtime</span>
                <select
                  className={inputClass}
                  value={runtime}
                  disabled={locked}
                  onChange={(e) => setRuntime(e.target.value)}
                >
                  {[...new Set([runtime, ...RUNTIMES].filter(Boolean))].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant">Code Override</span>
                <select
                  className={inputClass}
                  value={codeOverrideMode}
                  disabled={locked}
                  onChange={(e) => setCodeOverrideMode(e.target.value as Policy['platform']['codeOverrideMode'])}
                >
                  {OVERRIDE_MODES.map((m) => (
                    <option key={m} value={m}>
                      {humanize(m)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="font-body-sm text-body-sm text-on-surface-variant mt-sm">
              Source: policy <span className="font-mono">{policy.id}</span> ({humanize(policy.scope)} scope). Token budget and
              PII modes are enforced per job.
            </p>
          </div>

          <div className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-md opacity-80">
            <div className="flex justify-between items-center border-b border-outline-variant pb-md">
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 rounded bg-surface-dim border border-outline-variant flex items-center justify-center">
                  <Brain className="text-on-surface-variant" size={24} />
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Fallback providers</h3>
                  <div className="flex items-center gap-xs mt-xs">
                    <span className="w-2 h-2 rounded-full bg-surface-variant"></span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">H1</span>
                  </div>
                </div>
              </div>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Multi-provider failover and vault-backed API keys ship in H1. Edit the org policy model above for the
              active sandbox provider.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
