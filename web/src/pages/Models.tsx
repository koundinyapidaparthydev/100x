import { useEffect, useMemo, useState } from 'react';
import { Brain } from 'lucide-react';
import { api } from '@shared/api';
import type { Policy } from '@shared/types';
import GovernanceNav from '../components/GovernanceNav';
import { useAsync } from '../lib/useAsync';
import { AsyncBoundary, Card, Field, PageContainer, PageHeader, SaveBar, StatusBadge } from '../components/ui';
import { humanize } from '../lib/format';
import { readDemoSession } from '../lib/session';

const PROVIDERS = ['openai', 'anthropic', 'azure_openai', 'bedrock', 'custom'];
const RUNTIMES = ['cursor', 'claude_code', 'codex', 'custom'];
const OVERRIDE_MODES = ['forbidden', 'allowed_with_audit', 'allowed'] as const;
const selectClass =
  'mt-1.5 min-h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-surface-container disabled:text-on-surface-variant';

export default function Models() {
  const canManage = ['root', 'owner'].includes(readDemoSession()?.role ?? '');
  const { data: policies, loading, error, reload } = useAsync(() => api.listPolicies(), []);
  const policy = policies?.find((item) => item.scope === 'org') ?? policies?.[0] ?? null;

  const [provider, setProvider] = useState('');
  const [modelId, setModelId] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [runtime, setRuntime] = useState('');
  const [codeOverrideMode, setCodeOverrideMode] = useState<Policy['platform']['codeOverrideMode']>('forbidden');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const resetDraft = (source: Policy) => {
    setProvider(source.model.provider);
    setModelId(source.model.modelId);
    setEndpoint(source.model.endpoint ?? '');
    setRuntime(source.platform.runtime);
    setCodeOverrideMode(source.platform.codeOverrideMode);
  };

  useEffect(() => {
    if (policy) resetDraft(policy);
  }, [policy]);

  const locked = policy?.locks.models ?? false;
  const readOnly = locked || !canManage;
  const dirty = useMemo(
    () =>
      Boolean(
        policy &&
          (provider !== policy.model.provider ||
            modelId !== policy.model.modelId ||
            endpoint.trim() !== (policy.model.endpoint ?? '') ||
            runtime !== policy.platform.runtime ||
            codeOverrideMode !== policy.platform.codeOverrideMode),
      ),
    [codeOverrideMode, endpoint, modelId, policy, provider, runtime],
  );

  const save = async () => {
    if (!policy || readOnly) return;
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
      setMessage('Model runtime settings saved.');
      reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Model runtime settings could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer width="form" className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Governance / Policy workspace / Runtime"
        title="Model runtime"
        description="Select the provider, model identifier, and execution adapter stored on the organization policy."
        actions={locked ? <StatusBadge status="blocked" label="Editing locked by policy" /> : undefined}
      />

      <GovernanceNav />
      {!canManage && (
        <p className="rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
          Your role can review model runtime settings but cannot change them.
        </p>
      )}

      <AsyncBoundary
        loading={loading}
        error={error}
        empty={!loading && !error && !policy}
        loadingLabel="Loading model runtime…"
        emptyTitle="No policy configured"
        emptyBody="Model runtime settings become available when an organization policy exists."
        onRetry={reload}
      >
        {policy && (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(17rem,0.6fr)]">
              <Card
                title="Model and adapter"
                description={readOnly ? 'These fields are read-only for the current role or policy.' : 'Changes affect future jobs after you save.'}
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-on-surface">
                    Provider
                <select
                  className={selectClass}
                  value={provider}
                  disabled={readOnly}
                  onChange={(e) => setProvider(e.target.value)}
                >
                  {[...new Set([provider, ...PROVIDERS].filter(Boolean))].map((p) => (
                    <option key={p} value={p}>
                      {humanize(p)}
                    </option>
                  ))}
                </select>
                  </label>
                  <Field
                  label="Model identifier"
                  value={modelId}
                  disabled={readOnly}
                  onChange={(e) => setModelId(e.target.value)}
                />
                  <Field
                  className="sm:col-span-2"
                  label="Endpoint override"
                  hint="Leave empty to use the provider's default endpoint."
                  value={endpoint}
                  disabled={readOnly}
                  placeholder="Provider default"
                  onChange={(e) => setEndpoint(e.target.value)}
                />
                  <label className="block text-sm font-medium text-on-surface">
                    Runtime adapter
                <select
                  className={selectClass}
                  value={runtime}
                  disabled={readOnly}
                  onChange={(e) => setRuntime(e.target.value)}
                >
                  {[...new Set([runtime, ...RUNTIMES].filter(Boolean))].map((r) => (
                    <option key={r} value={r}>
                      {humanize(r)}
                    </option>
                  ))}
                </select>
                  </label>
                  <label className="block text-sm font-medium text-on-surface">
                    Code override
                <select
                  className={selectClass}
                  value={codeOverrideMode}
                  disabled={readOnly}
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
              </Card>

              <Card title="Configured value" actions={<Brain size={20} className="text-on-surface-variant" />}>
                <dl className="space-y-3 text-sm">
                  <div><dt className="text-on-surface-variant">Provider</dt><dd className="font-medium text-on-surface">{humanize(policy.model.provider)}</dd></div>
                  <div><dt className="text-on-surface-variant">Model</dt><dd className="break-all font-mono text-on-surface">{policy.model.modelId}</dd></div>
                  <div><dt className="text-on-surface-variant">Runtime adapter</dt><dd className="text-on-surface">{humanize(policy.platform.runtime)}</dd></div>
                  <div className="border-t border-outline-variant pt-3 text-xs leading-5 text-on-surface-variant">
                    This page shows saved configuration only. It does not test provider connectivity or credential validity.
                  </div>
                </dl>
              </Card>
            </div>

            <Card
              className="bg-surface-container-low"
              title="Fallback providers"
              description="Unavailable in this version. Only one model provider can be stored on the organization policy."
              actions={<StatusBadge status="unavailable" label="Unavailable" />}
            />
            {message && <p className="text-sm text-on-surface-variant">{message}</p>}
            <SaveBar
              dirty={dirty && !readOnly}
              saving={saving}
              message="Model runtime has unsaved changes."
              onSave={() => void save()}
              onDiscard={() => resetDraft(policy)}
            />
          </>
        )}
      </AsyncBoundary>
    </PageContainer>
  );
}
