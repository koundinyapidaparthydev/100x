import { useEffect, useMemo, useState } from 'react';
import { Brain } from 'lucide-react';
import { api } from '@shared/api';
import type { Policy, WorkspaceEnvironment } from '@shared/types';
import GovernanceNav from '../components/GovernanceNav';
import { useAsync } from '../lib/useAsync';
import {
  ACTIVE_ENV_CHANGED_EVENT,
  readCachedActiveEnvironmentId,
} from '../lib/environmentStorage';
import { AsyncBoundary, Card, Field, PageContainer, PageHeader, SaveBar, StatusBadge } from '../components/ui';
import { humanize } from '../lib/format';
import { readDemoSession } from '../lib/session';

/** Live + alias providers. Azure/Bedrock remain stored for future wiring. */
const PROVIDERS = [
  'auto',
  'openai',
  'anthropic',
  'openrouter',
  'deepseek',
  'kimi',
  'qwen',
  'grok',
  'nemotron',
  'azure_openai',
  'bedrock',
  'custom',
] as const;

const MODEL_PRESETS: Record<string, string[]> = {
  auto: ['auto'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'o4-mini'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-5-haiku-latest'],
  openrouter: [
    'openai/gpt-4o-mini',
    'anthropic/claude-sonnet-4',
    'deepseek/deepseek-chat',
    'moonshotai/kimi-k2',
    'qwen/qwen-2.5-72b-instruct',
    'x-ai/grok-3-mini',
    'nvidia/llama-3.1-nemotron-70b-instruct',
  ],
  deepseek: ['deepseek/deepseek-chat', 'deepseek/deepseek-r1'],
  kimi: ['moonshotai/kimi-k2'],
  qwen: ['qwen/qwen-2.5-72b-instruct', 'qwen/qwen3-32b'],
  grok: ['x-ai/grok-3-mini', 'x-ai/grok-3'],
  nemotron: ['nvidia/llama-3.1-nemotron-70b-instruct'],
};

const RUNTIMES = ['cursor', 'claude_code', 'codex', 'custom'];
const OVERRIDE_MODES = ['forbidden', 'allowed_with_audit', 'allowed'] as const;
const selectClass =
  'mt-1.5 min-h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-surface-container disabled:text-on-surface-variant';

function providerHint(provider: string): string {
  switch (provider) {
    case 'auto':
      return 'Uses the first configured backend key: OpenAI → Anthropic → OpenRouter.';
    case 'openrouter':
    case 'deepseek':
    case 'kimi':
    case 'qwen':
    case 'grok':
    case 'nemotron':
      return 'Requires OPENROUTER_API_KEY on the backend. Alias providers map to OpenRouter model ids.';
    case 'openai':
      return 'Requires OPENAI_API_KEY on the backend.';
    case 'anthropic':
      return 'Requires ANTHROPIC_API_KEY on the backend.';
    case 'azure_openai':
    case 'bedrock':
      return 'Stored on policy only in this version — not a live runner path yet.';
    default:
      return 'Custom provider labels are stored on policy; live calls need a supported key.';
  }
}

export default function Models() {
  const canManage = ['root', 'owner'].includes(readDemoSession()?.role ?? '');
  const [activeEnvId, setActiveEnvId] = useState<string | null>(() => readCachedActiveEnvironmentId());
  const { data: envState, reload: reloadEnvs } = useAsync(() => api.listEnvironments(), []);
  const { data: policies, loading, error, reload } = useAsync(() => api.listPolicies(), [activeEnvId]);
  const { data: health } = useAsync(() => api.health(), []);

  useEffect(() => {
    const onEnv = (event: Event) => {
      const id = (event as CustomEvent<{ environmentId?: string }>).detail?.environmentId;
      if (typeof id === 'string' && id) setActiveEnvId(id);
      else setActiveEnvId(readCachedActiveEnvironmentId());
      reload();
      reloadEnvs();
    };
    window.addEventListener(ACTIVE_ENV_CHANGED_EVENT, onEnv);
    return () => window.removeEventListener(ACTIVE_ENV_CHANGED_EVENT, onEnv);
  }, [reload, reloadEnvs]);

  useEffect(() => {
    if (!envState) return;
    if (!activeEnvId || !envState.environments.some((e) => e.id === activeEnvId)) {
      setActiveEnvId(envState.activeEnvironmentId);
    }
  }, [activeEnvId, envState]);

  const activeEnv: WorkspaceEnvironment | null =
    envState?.environments.find((e) => e.id === (activeEnvId ?? envState.activeEnvironmentId)) ??
    envState?.environments[0] ??
    null;
  const orgBase = policies?.find((item) => item.environmentId == null) ?? null;
  const policy =
    (activeEnv
      ? policies?.find((item) => item.environmentId === activeEnv.id)
      : null) ??
    policies?.find((item) => item.environmentId != null) ??
    null;

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

  const locked = orgBase?.locks.models ?? policy?.locks.models ?? false;
  const readOnly = locked || !canManage;
  const presets = MODEL_PRESETS[provider] ?? [];
  const configured = health?.modelProviders ?? [];
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

  const selectProvider = (next: string) => {
    setProvider(next);
    const nextPresets = MODEL_PRESETS[next] ?? [];
    if (nextPresets.length > 0 && (!modelId || modelId === 'auto' || !(MODEL_PRESETS[provider] ?? []).includes(modelId))) {
      setModelId(nextPresets[0]);
    }
  };

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
    <PageContainer width="form" className="flex flex-col gap-6" data-testid="models-page">
      <PageHeader
        eyebrow="Governance / Policy workspace / Runtime"
        title="Model runtime"
        description="Choose provider and model for AI drafts in the active environment. Keys live in backend env — this page stores the per-environment preference."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {activeEnv ? (
              <StatusBadge status="running" label={`Editing · ${activeEnv.name}`} />
            ) : null}
            {locked ? <StatusBadge status="blocked" label="Editing locked by policy" /> : null}
          </div>
        }
      />

      <GovernanceNav />
      <p className="rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
        PII and runtime are per environment; switch env in the top bar. Org-wide locks still apply.
      </p>
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
                data-testid="model-edit-form"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-on-surface">
                    Provider
                    <select
                      className={selectClass}
                      value={provider}
                      disabled={readOnly}
                      onChange={(e) => selectProvider(e.target.value)}
                      data-testid="model-provider"
                    >
                      {[...new Set([provider, ...PROVIDERS].filter(Boolean))].map((p) => (
                        <option key={p} value={p}>
                          {humanize(p)}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1.5 block text-xs font-normal text-on-surface-variant">
                      {providerHint(provider)}
                    </span>
                  </label>
                  <label className="block text-sm font-medium text-on-surface">
                    Model identifier
                    <input
                      className={selectClass}
                      list="model-id-presets"
                      value={modelId}
                      disabled={readOnly}
                      onChange={(e) => setModelId(e.target.value)}
                      data-testid="model-id"
                    />
                    <datalist id="model-id-presets">
                      {presets.map((id) => (
                        <option key={id} value={id} />
                      ))}
                    </datalist>
                    {presets.length > 0 && (
                      <span className="mt-1.5 block text-xs font-normal text-on-surface-variant">
                        Suggestions: {presets.slice(0, 4).join(', ')}
                        {presets.length > 4 ? '…' : ''}
                      </span>
                    )}
                  </label>
                  <Field
                    className="sm:col-span-2"
                    label="Endpoint override"
                    hint="Leave empty to use the provider default (or OPENAI_BASE_URL / ANTHROPIC_BASE_URL / OPENROUTER_BASE_URL)."
                    value={endpoint}
                    disabled={readOnly}
                    placeholder="Provider default"
                    onChange={(e) => setEndpoint(e.target.value)}
                    data-testid="model-endpoint"
                  />
                  <label className="block text-sm font-medium text-on-surface">
                    Runtime adapter
                    <select
                      className={selectClass}
                      value={runtime}
                      disabled={readOnly}
                      onChange={(e) => setRuntime(e.target.value)}
                      data-testid="model-runtime"
                    >
                      {[...new Set([runtime, ...RUNTIMES].filter(Boolean))].map((r) => (
                        <option key={r} value={r}>
                          {humanize(r)}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1.5 block text-xs font-normal text-on-surface-variant">
                      Adapter labels (Cursor, Claude Code, Codex) describe where humans continue work — they are not API keys for Cursor/Composer models.
                    </span>
                  </label>
                  <label className="block text-sm font-medium text-on-surface">
                    Code override
                    <select
                      className={selectClass}
                      value={codeOverrideMode}
                      disabled={readOnly}
                      onChange={(e) => setCodeOverrideMode(e.target.value as Policy['platform']['codeOverrideMode'])}
                      data-testid="model-code-override"
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
                    Backend runner: {health?.modelRunner ?? '…'}
                    {configured.length > 0
                      ? ` · keys present: ${configured.join(', ')}`
                      : ' · no live keys (sandbox drafts)'}
                  </div>
                </dl>
              </Card>
            </div>

            <Card
              className="bg-surface-container-low"
              title="Provider notes"
              description="Live inference uses backend env keys. Cursor Composer and other IDE-only models are not available as customer-keyed APIs here — use OpenRouter (or OpenAI/Anthropic) for cloud models, including Grok via x-ai/* ids."
            />
            {message && <p className="text-sm text-on-surface-variant" data-testid="model-save-message">{message}</p>}
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
