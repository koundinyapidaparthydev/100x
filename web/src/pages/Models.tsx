import { Brain, Lock, Settings } from 'lucide-react';
import { api } from '@shared/api';
import { useAsync } from '../lib/useAsync';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import Chip from '../components/Chip';
import { humanize } from '../lib/format';

export default function Models() {
  const { data: policies, loading, error, reload } = useAsync(() => api.listPolicies(), []);
  const policy = policies?.[0] ?? null;

  return (
    <div className="max-w-container-max mx-auto p-margin flex flex-col gap-xl">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-semibold text-on-surface">Models & Platforms</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-sm max-w-2xl">
            Configure and manage AI providers, API keys, and model-specific parameters.
          </p>
        </div>
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
          {/* Active provider (from policy) */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-md">
            <div className="flex justify-between items-center border-b border-outline-variant pb-md">
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 rounded bg-surface-container-lowest border border-outline-variant flex items-center justify-center">
                  <Brain className="text-on-surface" size={24} />
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">{humanize(policy.model.provider)}</h3>
                  <div className="flex items-center gap-xs mt-xs">
                    <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
                    <span className="font-label-sm text-label-sm text-tertiary uppercase">Connected</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-xs">
                {policy.locks.models && (
                  <Chip tone="error">
                    <Lock size={12} /> Locked
                  </Chip>
                )}
                <button className="p-sm text-on-surface-variant hover:bg-surface-variant rounded transition-colors">
                  <Settings size={20} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-md">
              <div className="bg-surface-variant/50 p-sm rounded border border-outline-variant/50">
                <span className="font-label-sm text-label-sm text-on-surface-variant block mb-xs">Default Model</span>
                <span className="font-body-sm text-body-sm text-on-surface font-semibold font-mono">{policy.model.modelId}</span>
              </div>
              <div className="bg-surface-variant/50 p-sm rounded border border-outline-variant/50">
                <span className="font-label-sm text-label-sm text-on-surface-variant block mb-xs">Endpoint</span>
                <span className="font-body-sm text-body-sm text-on-surface font-mono break-all">
                  {policy.model.endpoint ?? 'Provider default'}
                </span>
              </div>
              <div className="bg-surface-variant/50 p-sm rounded border border-outline-variant/50">
                <span className="font-label-sm text-label-sm text-on-surface-variant block mb-xs">Platform Runtime</span>
                <span className="font-body-sm text-body-sm text-on-surface">{policy.platform.runtime}</span>
              </div>
              <div className="bg-surface-variant/50 p-sm rounded border border-outline-variant/50">
                <span className="font-label-sm text-label-sm text-on-surface-variant block mb-xs">Code Override</span>
                <span className="font-body-sm text-body-sm text-on-surface">{humanize(policy.platform.codeOverrideMode)}</span>
              </div>
            </div>

            <p className="font-body-sm text-body-sm text-on-surface-variant mt-sm">
              Source: policy <span className="font-mono">{policy.id}</span> ({humanize(policy.scope)} scope). Token budget and
              PII modes are enforced per job.
            </p>
          </div>

          {/* Fallback provider (static, not yet connected) */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-md opacity-80">
            <div className="flex justify-between items-center border-b border-outline-variant pb-md">
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 rounded bg-surface-dim border border-outline-variant flex items-center justify-center">
                  <Brain className="text-on-surface-variant" size={24} />
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Anthropic</h3>
                  <div className="flex items-center gap-xs mt-xs">
                    <span className="w-2 h-2 rounded-full bg-surface-variant"></span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Disconnected</span>
                  </div>
                </div>
              </div>
              <button className="font-label-md text-label-md text-tertiary hover:underline px-sm py-xs">Configure</button>
            </div>

            <div className="grid grid-cols-2 gap-md">
              <div className="bg-surface-variant/50 p-sm rounded border border-outline-variant/50">
                <span className="font-label-sm text-label-sm text-on-surface-variant block mb-xs">Available Models</span>
                <span className="font-body-sm text-body-sm text-on-surface font-mono">claude-sonnet-4</span>
              </div>
              <div className="bg-surface-variant/50 p-sm rounded border border-outline-variant/50 flex items-center justify-center">
                <span className="font-label-sm text-label-sm text-on-surface-variant text-center">API Key Required</span>
              </div>
            </div>

            <p className="font-body-sm text-body-sm text-on-surface-variant mt-sm">
              Connect a fallback provider so delegation continues if the primary endpoint is unavailable.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
