import { useEffect, useMemo, useState } from 'react';
import { Cloud as CloudIcon, Globe, Link2, Lock } from 'lucide-react';
import { api } from '@shared/api';
import {
  PRIVATE_CLOUD_PROVIDERS,
  type CloudProvider,
  type Policy,
  type ServiceId,
} from '@shared/types';
import GovernanceNav from '../components/GovernanceNav';
import { useAsync } from '../lib/useAsync';
import { AsyncBoundary, Card, Field, PageContainer, PageHeader, SaveBar, StatusBadge } from '../components/ui';
import { cloudModeDisplay, providerDisplay } from '../lib/format';
import { readDemoSession } from '../lib/session';
import { cn } from '../lib/utils';

const MODES: {
  id: Policy['cloud']['mode'];
  title: string;
  description: string;
}[] = [
  {
    id: 'customer_cloud',
    title: 'Connected cloud accounts',
    description:
      'Run AI in AWS, Azure, GCP, or NVIDIA accounts you already linked. We use your account — we do not create a separate one.',
  },
  {
    id: 'public_managed',
    title: 'AplifyAI private cloud',
    description:
      'Run on our managed private cloud. No customer AWS, Azure, GCP, or NVIDIA account required.',
  },
  {
    id: 'private_vpc',
    title: 'Your cloud (BYOC)',
    description:
      'Bring your own cloud. Choose the platform and connect that account under Connections.',
  },
];

const CLOUD_SERVICE_IDS: ServiceId[] = ['aws', 'azure', 'gcp', 'nvidia'];

const selectClass =
  'mt-1.5 min-h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-surface-container disabled:text-on-surface-variant';

export default function Cloud() {
  const canManage = ['root', 'manager'].includes(readDemoSession()?.role ?? '');
  const { data: policies, loading, error, reload } = useAsync(() => api.listPolicies(), []);
  const { data: mcp } = useAsync(() => api.listMcpConnections(), []);
  const { data: onboarding } = useAsync(() => api.getOnboarding(), []);
  const policy = policies?.find((item) => item.scope === 'org') ?? policies?.[0] ?? null;

  const [provider, setProvider] = useState<CloudProvider>('azure');
  const [mode, setMode] = useState<Policy['cloud']['mode']>('public_managed');
  const [region, setRegion] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const connectedCloudProviders = useMemo(() => {
    const fromMcp = new Set(
      (mcp?.connections ?? [])
        .filter((c) => c.status === 'connected' && CLOUD_SERVICE_IDS.includes(c.serviceId))
        .map((c) => c.serviceId as CloudProvider),
    );
    const selected = onboarding?.profile?.selectedServices ?? [];
    for (const id of selected) {
      if (CLOUD_SERVICE_IDS.includes(id)) fromMcp.add(id as CloudProvider);
    }
    return PRIVATE_CLOUD_PROVIDERS.filter((p) => fromMcp.has(p));
  }, [mcp, onboarding]);

  const resetDraft = (source: Policy) => {
    setProvider(source.cloud.provider);
    setMode(source.cloud.mode);
    setRegion(source.cloud.region);
    setCustomLabel(source.cloud.customLabel ?? '');
  };

  useEffect(() => {
    if (policy) resetDraft(policy);
  }, [policy]);

  const locked = policy?.locks.cloud ?? false;
  const readOnly = locked || !canManage;
  const needsCustomLabel = provider === 'custom' && mode === 'private_vpc';
  const customLabelMissing = needsCustomLabel && !customLabel.trim();
  const showPlatform = mode === 'customer_cloud' || mode === 'private_vpc';
  const platformOptions: CloudProvider[] =
    mode === 'customer_cloud'
      ? connectedCloudProviders.length > 0
        ? connectedCloudProviders
        : (['aws', 'azure', 'gcp', 'nvidia'] as CloudProvider[])
      : PRIVATE_CLOUD_PROVIDERS;

  const dirty = useMemo(
    () =>
      Boolean(
        policy &&
          (provider !== policy.cloud.provider ||
            mode !== policy.cloud.mode ||
            region !== policy.cloud.region ||
            (customLabel.trim() || undefined) !== (policy.cloud.customLabel ?? undefined)),
      ),
    [customLabel, mode, policy, provider, region],
  );

  const selectMode = (next: Policy['cloud']['mode']) => {
    setMode(next);
    if (next === 'public_managed') {
      setProvider('private');
      setCustomLabel('');
      return;
    }
    if (next === 'customer_cloud') {
      const preferred =
        (connectedCloudProviders.includes(provider) && provider) ||
        connectedCloudProviders[0] ||
        'aws';
      setProvider(preferred);
      setCustomLabel('');
      return;
    }
    if (provider === 'private') setProvider('aws');
  };

  const save = async () => {
    if (!policy || readOnly || customLabelMissing) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.updatePolicy(policy.id, {
        cloud: {
          provider: mode === 'public_managed' ? 'private' : provider,
          mode,
          region,
          customLabel: needsCustomLabel ? customLabel.trim() : undefined,
        },
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
        description="Choose connected customer accounts, AplifyAI private cloud, or bring-your-own-cloud — then pick the specific platform when needed."
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
                title="Where AI runs"
                description={
                  readOnly
                    ? 'These fields are read-only for the current role or policy.'
                    : 'If you link AWS, Azure, GCP, or NVIDIA, you can run AI in those accounts instead of an AplifyAI-created one.'
                }
              >
                <div
                  className="grid gap-2 sm:grid-cols-3"
                  role="radiogroup"
                  aria-label="Cloud account source"
                  data-testid="cloud-account-source"
                >
                  {MODES.map((option) => {
                    const selected = mode === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={readOnly}
                        data-testid={`cloud-mode-${option.id}`}
                        onClick={() => selectMode(option.id)}
                        className={cn(
                          'flex flex-col rounded-lg border px-3 py-3 text-left transition',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          selected
                            ? 'border-primary bg-primary-container/50'
                            : 'border-outline-variant bg-surface hover:border-primary/40',
                          readOnly && 'opacity-70',
                        )}
                      >
                        <span className="text-sm font-semibold text-on-surface">{option.title}</span>
                        <span className="mt-1 text-xs leading-5 text-on-surface-variant">
                          {option.description}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {mode === 'customer_cloud' && (
                  <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-on-surface-variant">
                    <Link2 size={14} className="mt-0.5 shrink-0" aria-hidden />
                    {connectedCloudProviders.length > 0
                      ? `Linked / selected clouds: ${connectedCloudProviders.map((p) => providerDisplay(p)).join(', ')}.`
                      : 'No cloud accounts linked yet — pick a platform below and connect it under Connections.'}
                  </p>
                )}

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {showPlatform && (
                    <label className="block text-sm font-medium text-on-surface">
                      {mode === 'customer_cloud' ? 'Which connected cloud?' : 'Cloud platform'}
                      <select
                        className={selectClass}
                        value={provider}
                        disabled={readOnly}
                        data-testid="cloud-provider"
                        onChange={(e) => setProvider(e.target.value as CloudProvider)}
                      >
                        {platformOptions.map((p) => (
                          <option key={p} value={p}>
                            {providerDisplay(p)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <Field
                    label="Region"
                    value={region}
                    disabled={readOnly}
                    onChange={(e) => setRegion(e.target.value)}
                  />
                </div>

                {needsCustomLabel && (
                  <div className="mt-4">
                    <Field
                      label="Platform name"
                      hint="Name the cloud or GPU platform you want to use (e.g. Oracle Cloud, CoreWeave, on-prem Kubernetes)."
                      value={customLabel}
                      disabled={readOnly}
                      placeholder="e.g. Oracle Cloud"
                      onChange={(e) => setCustomLabel(e.target.value)}
                    />
                  </div>
                )}
              </Card>

              <Card title="Saved runtime" actions={<CloudIcon size={20} className="text-on-surface-variant" />}>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-on-surface-variant">Account source</dt>
                    <dd className="font-medium text-on-surface">{cloudModeDisplay(policy.cloud.mode)}</dd>
                  </div>
                  <div>
                    <dt className="text-on-surface-variant">Provider</dt>
                    <dd className="font-medium text-on-surface">
                      {providerDisplay(policy.cloud.provider, policy.cloud.customLabel)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-on-surface-variant">Region</dt>
                    <dd className="flex items-center gap-1.5 text-on-surface">
                      <Globe size={14} /> {policy.cloud.region}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2 border-t border-outline-variant pt-3 text-xs text-on-surface-variant">
                    <Lock size={14} /> {locked ? 'Cloud setting lock is enabled.' : 'Cloud settings are editable.'}
                  </div>
                </dl>
              </Card>
            </div>

            <Card title="What this setting means" className="bg-surface-container-low">
              <p className="text-sm leading-6 text-on-surface-variant">
                Connected accounts and BYOC run under the customer’s cloud billing and IAM. AplifyAI
                private cloud runs on our managed plane. The selected provider, mode, and region are
                stamped onto future AI jobs; this page does not verify network isolation or account
                ownership by itself.
              </p>
            </Card>
            {message && <p className="text-sm text-on-surface-variant">{message}</p>}
            {customLabelMissing && !readOnly && (
              <p className="text-sm text-error">Enter a platform name when using Other platform.</p>
            )}
            <SaveBar
              dirty={dirty && !readOnly && !customLabelMissing}
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
