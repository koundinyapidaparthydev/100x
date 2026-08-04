import { useEffect, useMemo, useState } from 'react';
import { Cloud, Cpu, ShieldCheck } from 'lucide-react';
import { api } from '@shared/api';
import type { Policy, SecurityLevel } from '@shared/types';
import GovernanceNav from '../components/GovernanceNav';
import { useAsync } from '../lib/useAsync';
import { AsyncBoundary, Card, Field, PageContainer, PageHeader, SaveBar, StatusBadge } from '../components/ui';
import { cloudModeDisplay, formatTokens, humanize, providerDisplay } from '../lib/format';
import { readDemoSession } from '../lib/session';

const SECURITY_LEVELS: SecurityLevel[] = ['standard', 'elevated', 'enterprise', 'custom'];

function piiSummary(policy: Policy): string {
  const counts = new Map<string, number>();
  for (const rule of Object.values(policy.pii)) {
    const mode = typeof rule === 'string' ? rule : rule.mode;
    counts.set(mode, (counts.get(mode) ?? 0) + 1);
  }
  return [...counts.entries()].map(([mode, n]) => `${n} ${mode}`).join(' · ');
}

export default function Policies() {
  const canManage = ['root', 'owner'].includes(readDemoSession()?.role ?? '');
  const { data: policies, loading, error, reload } = useAsync(() => api.listPolicies(), []);
  const policy = policies?.find((item) => item.scope === 'org') ?? policies?.[0] ?? null;
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel>('standard');
  const [targetCompletion, setTargetCompletion] = useState(0);
  const [maxTokens, setMaxTokens] = useState(0);
  const [aiFirstDefault, setAiFirstDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const resetDraft = (source: Policy) => {
    setSecurityLevel(source.securityLevel);
    setTargetCompletion(source.targetCompletionPercentDefault);
    setMaxTokens(source.tokenBudget.maxTotalTokens);
    setAiFirstDefault(source.aiFirstDefault);
  };

  useEffect(() => {
    if (policy) resetDraft(policy);
  }, [policy]);

  const dirty = useMemo(
    () =>
      Boolean(
        policy &&
          (securityLevel !== policy.securityLevel ||
            targetCompletion !== policy.targetCompletionPercentDefault ||
            maxTokens !== policy.tokenBudget.maxTotalTokens ||
            aiFirstDefault !== policy.aiFirstDefault),
      ),
    [aiFirstDefault, maxTokens, policy, securityLevel, targetCompletion],
  );

  const save = async () => {
    if (!policy || !canManage) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.updatePolicy(policy.id, {
        securityLevel,
        targetCompletionPercentDefault: targetCompletion,
        aiFirstDefault,
        tokenBudget: { ...policy.tokenBudget, maxTotalTokens: maxTokens },
      });
      setMessage('Policy settings saved.');
      reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Policy settings could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer width="form" className="flex flex-col gap-6" data-testid="policies-page">
      <PageHeader
        eyebrow="Governance / Policy workspace"
        title="Policy defaults"
        description="Set the defaults used when work is assigned. Sensitive-data rules and runtime settings live in the same policy workspace."
        actions={policy ? <StatusBadge status={policy.scope} label={`${humanize(policy.scope)} scope`} /> : undefined}
      />

      <GovernanceNav />
      {!canManage && (
        <p className="rounded-card border border-butter/20 bg-butter-container px-3 py-2 text-sm text-on-butter-container">
          Your role can review policy defaults but cannot change them.
        </p>
      )}

      <AsyncBoundary
        loading={loading}
        error={error}
        empty={!loading && !error && !policy}
        loadingLabel="Loading policy settings…"
        emptyTitle="No policy configured"
        emptyBody="Policy creation is not available in this interface."
        onRetry={reload}
      >
        {policy && (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
              <Card
                title="Assignment defaults"
                description="These values apply when a work item does not provide an explicit override."
                data-testid="policy-edit-form"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-on-surface">
                    Security level
                    <select
                      className="mt-1.5 min-h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                      value={securityLevel}
                      disabled={!canManage}
                      onChange={(event) => setSecurityLevel(event.target.value as SecurityLevel)}
                      data-testid="policy-security-level"
                    >
                      {SECURITY_LEVELS.map((level) => (
                        <option key={level} value={level}>{humanize(level)}</option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Target AI completion"
                    hint="A planning target, not a guarantee of output quality or completion."
                    error={targetCompletion < 0 || targetCompletion > 100 ? 'Enter a value from 0 to 100.' : undefined}
                    type="number"
                    min={0}
                    max={100}
                    disabled={!canManage}
                    value={targetCompletion}
                    onChange={(event) => setTargetCompletion(Math.min(100, Math.max(0, Number(event.target.value))))}
                    data-testid="policy-target-completion"
                  />
                  <Field
                    label="Token limit per job"
                    hint="The job is blocked when its estimate exceeds this limit."
                    error={maxTokens < 0 ? 'Enter zero or a positive number.' : undefined}
                    type="number"
                    min={0}
                    disabled={!canManage}
                    value={maxTokens}
                    onChange={(event) => setMaxTokens(Math.max(0, Number(event.target.value)))}
                    data-testid="policy-max-tokens"
                  />
                  <label className="flex items-start gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface">
                    <input
                      type="checkbox"
                      checked={aiFirstDefault}
                      disabled={!canManage}
                      onChange={(event) => setAiFirstDefault(event.target.checked)}
                      className="mt-0.5"
                      data-testid="policy-ai-first-default"
                    />
                    <span>
                      <span className="block font-medium">Send new work to AI by default</span>
                      <span className="mt-1 block text-xs text-on-surface-variant">Managers can still choose a person during triage.</span>
                    </span>
                  </label>
                </div>
              </Card>

              <Card title="Current policy" description={policy.id}>
                <dl className="space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <Cpu size={18} className="mt-0.5 text-on-surface-variant" />
                    <div><dt className="font-medium text-on-surface">Model runtime</dt><dd className="text-on-surface-variant">{humanize(policy.model.provider)} · {policy.model.modelId}</dd></div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Cloud size={18} className="mt-0.5 text-on-surface-variant" />
                    <div><dt className="font-medium text-on-surface">Execution location</dt><dd className="text-on-surface-variant">{providerDisplay(policy.cloud.provider, policy.cloud.customLabel)} · {policy.cloud.region} · {cloudModeDisplay(policy.cloud.mode)}</dd></div>
                  </div>
                  <div className="flex items-start gap-3">
                    <ShieldCheck size={18} className="mt-0.5 text-on-surface-variant" />
                    <div><dt className="font-medium text-on-surface">PII handling</dt><dd className="text-on-surface-variant">{piiSummary(policy)}</dd></div>
                  </div>
                  <div className="border-t border-outline-variant pt-3 text-on-surface-variant">
                    Current token limit: {formatTokens(policy.tokenBudget.maxTotalTokens)} · on exhaustion: {humanize(policy.tokenBudget.onExhaustion)}
                  </div>
                </dl>
              </Card>
            </div>
            {message && <p className="text-sm text-on-surface-variant" data-testid="policy-save-message">{message}</p>}
            <SaveBar
              dirty={dirty && canManage}
              saving={saving}
              message="Policy defaults have unsaved changes."
              onSave={() => void save()}
              onDiscard={() => resetDraft(policy)}
            />
          </>
        )}
      </AsyncBoundary>
    </PageContainer>
  );
}
