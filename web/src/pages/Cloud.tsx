import { Cloud as CloudIcon, Globe, KeyRound, Lock, LockOpen, ShieldCheck } from 'lucide-react';
import { api } from '@shared/api';
import { useAsync } from '../lib/useAsync';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import Chip from '../components/Chip';
import { cloudModeDisplay, humanize, providerDisplay } from '../lib/format';

export default function Cloud() {
  const { data: policies, loading, error, reload } = useAsync(() => api.listPolicies(), []);
  const policy = policies?.[0] ?? null;

  return (
    <div className="max-w-container-max mx-auto p-margin flex flex-col gap-xl">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-semibold text-on-surface">Cloud & Security</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-sm max-w-2xl">
            Where AI jobs execute — provider, deployment mode, and region are set by policy and locked by the founder.
          </p>
        </div>
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
          {/* Main status */}
          <div className="lg:col-span-2 glass-panel rounded-xl p-lg flex flex-col justify-between gap-xl">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-sm">
                <CloudIcon size={32} className="text-tertiary" />
                <h3 className="font-headline-md text-headline-md font-semibold text-on-surface">
                  {providerDisplay(policy.cloud.provider)}
                </h3>
              </div>
              <div className="px-sm py-1 bg-tertiary/10 border border-tertiary/30 text-tertiary font-label-sm text-label-sm rounded uppercase tracking-wider flex items-center gap-xs">
                <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
                {policy.cloud.region}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
              <div className="bg-surface-container-high p-md rounded border border-outline-variant">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-xs mb-sm">
                  <CloudIcon size={14} /> Provider
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface">{humanize(policy.cloud.provider)}</span>
                <span className="font-label-sm text-label-sm text-tertiary block mt-xs">Active</span>
              </div>
              <div className="bg-surface-container-high p-md rounded border border-outline-variant">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-xs mb-sm">
                  <Globe size={14} /> Region
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface">{policy.cloud.region}</span>
                <span className="font-label-sm text-label-sm text-tertiary block mt-xs">Pinned by policy</span>
              </div>
              <div className="bg-surface-container-high p-md rounded border border-outline-variant">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-xs mb-sm">
                  <KeyRound size={14} /> Mode
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface">{cloudModeDisplay(policy.cloud.mode)}</span>
                <span className="font-label-sm text-label-sm text-tertiary block mt-xs">Execution isolation</span>
              </div>
              <div className="bg-surface-container-high p-md rounded border border-outline-variant">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-xs mb-sm">
                  <ShieldCheck size={14} /> Security
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface">{humanize(policy.securityLevel)}</span>
                <span className="font-label-sm text-label-sm text-tertiary block mt-xs">Policy level</span>
              </div>
            </div>
          </div>

          {/* Execution governance */}
          <div className="glass-panel rounded-xl p-lg flex flex-col gap-md">
            <div className="flex items-center gap-sm mb-xs">
              <ShieldCheck size={24} className="text-on-surface" />
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Execution Governance</h3>
            </div>

            <div className="flex justify-between items-center p-sm rounded bg-surface-container-highest border border-outline-variant/30">
              <span className="font-body-sm text-body-sm text-on-surface">Cloud lock</span>
              {policy.locks.cloud ? (
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
              <Chip tone={policy.platform.codeOverrideMode === 'forbidden' ? 'error' : policy.platform.codeOverrideMode === 'allowed_with_audit' ? 'warning' : 'tertiary'}>
                {humanize(policy.platform.codeOverrideMode)}
              </Chip>
            </div>
            <div className="flex justify-between items-center p-sm rounded bg-surface-container-highest border border-outline-variant/30">
              <span className="font-body-sm text-body-sm text-on-surface">Budget exhaustion</span>
              <Chip tone={policy.tokenBudget.onExhaustion === 'block' ? 'error' : 'warning'}>
                {humanize(policy.tokenBudget.onExhaustion)}
              </Chip>
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
