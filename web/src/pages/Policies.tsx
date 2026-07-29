import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Cpu, FileCheck, Lock, LockOpen, Search, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api';
import type { Policy, SecurityLevel } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import Chip, { type ChipTone } from '../components/Chip';
import { cloudModeDisplay, formatTokens, humanize, providerDisplay } from '../lib/format';

const LEVEL_TONE: Record<SecurityLevel, ChipTone> = {
  standard: 'surface',
  elevated: 'tertiary',
  enterprise: 'primary',
  custom: 'secondary',
};

const SCOPE_TONE: Record<Policy['scope'], ChipTone> = {
  org: 'secondary',
  project: 'tertiary',
  ticket: 'surface',
};

const SECURITY_LEVELS: SecurityLevel[] = ['standard', 'elevated', 'enterprise', 'custom'];

const LOCK_LABELS: { key: keyof Policy['locks']; label: string }[] = [
  { key: 'models', label: 'Models' },
  { key: 'securityMin', label: 'Security Min' },
  { key: 'cloud', label: 'Cloud' },
];

const inputClass =
  'w-full h-9 bg-surface-variant border border-outline-variant/50 rounded text-body-sm text-on-surface px-3 outline-none focus:border-outline-variant';

function piiSummary(policy: Policy): string {
  const counts = new Map<string, number>();
  for (const mode of Object.values(policy.pii)) {
    counts.set(mode, (counts.get(mode) ?? 0) + 1);
  }
  return [...counts.entries()].map(([mode, n]) => `${n} ${mode}`).join(' · ');
}

function OrgPolicyEditor({ policy, onSaved }: { policy: Policy; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel>(policy.securityLevel);
  const [targetCompletion, setTargetCompletion] = useState(policy.targetCompletionPercentDefault);
  const [maxTokens, setMaxTokens] = useState(policy.tokenBudget.maxTotalTokens);
  const [aiFirstDefault, setAiFirstDefault] = useState(policy.aiFirstDefault);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setSecurityLevel(policy.securityLevel);
    setTargetCompletion(policy.targetCompletionPercentDefault);
    setMaxTokens(policy.tokenBudget.maxTotalTokens);
    setAiFirstDefault(policy.aiFirstDefault);
  }, [policy]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.updatePolicy(policy.id, {
        securityLevel,
        targetCompletionPercentDefault: targetCompletion,
        aiFirstDefault,
        tokenBudget: {
          ...policy.tokenBudget,
          maxTotalTokens: maxTokens,
        },
      });
      setMessage({ tone: 'ok', text: 'Policy saved.' });
      onSaved();
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-md pt-md border-t border-outline-variant">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left font-label-md text-label-md text-tertiary hover:underline"
      >
        Edit org policy
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="mt-md flex flex-col gap-md">
          <label className="flex flex-col gap-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Security level</span>
            <select
              className={inputClass}
              value={securityLevel}
              onChange={(e) => setSecurityLevel(e.target.value as SecurityLevel)}
            >
              {SECURITY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {humanize(level)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Target completion %</span>
            <input
              type="number"
              min={0}
              max={100}
              className={inputClass}
              value={targetCompletion}
              onChange={(e) => setTargetCompletion(Number(e.target.value))}
            />
          </label>
          <label className="flex flex-col gap-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Token budget (max total)</span>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-sm font-body-sm text-body-sm text-on-surface">
            <input
              type="checkbox"
              checked={aiFirstDefault}
              onChange={(e) => setAiFirstDefault(e.target.checked)}
              className="rounded border-outline-variant"
            />
            AI-first default
          </label>
          <div className="flex items-center gap-md">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="px-md py-sm rounded bg-tertiary text-on-tertiary font-label-md text-label-md font-bold hover:bg-tertiary-fixed transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {message && (
              <span
                className={`font-body-sm text-body-sm ${message.tone === 'ok' ? 'text-tertiary' : 'text-error'}`}
              >
                {message.text}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Policies() {
  const { data: policies, loading, error, reload } = useAsync(() => api.listPolicies(), []);
  const [search, setSearch] = useState('');

  const filtered = (policies ?? []).filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [p.id, p.scope, p.securityLevel, p.model.modelId].join(' ').toLowerCase().includes(q);
  });

  return (
    <div className="max-w-container-max mx-auto p-margin flex flex-col gap-xl">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-semibold text-on-surface">Delegation Policies</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-sm max-w-2xl">
            Manage security boundaries, PII redaction rules, and approval workflows for AI agents.
          </p>
        </div>
        <button
          type="button"
          disabled
          title="H0 supports a single org policy"
          className="px-md py-sm rounded border border-outline-variant text-on-surface-variant font-label-md text-label-md flex items-center gap-xs opacity-60 cursor-not-allowed"
        >
          Org policy only
        </button>
      </div>

      <div className="bg-surface-container rounded-lg border border-outline-variant p-sm flex items-center gap-md">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search policies..."
            className="w-full h-9 bg-surface-variant border border-transparent rounded focus:border-outline-variant focus:ring-0 text-body-sm text-on-surface pl-10 pr-3 placeholder-on-surface-variant outline-none"
          />
        </div>
      </div>

      {loading && <LoadingState label="Loading policies…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && policies && policies.length === 0 && (
        <EmptyState
          icon={<FileCheck size={22} />}
          title="No policies defined"
          body="Create a policy to set AI-first defaults, token budgets, and PII modes."
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
          {filtered.map((policy) => (
            <div
              key={policy.id}
              className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-md relative overflow-hidden group hover:border-tertiary/50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-sm">
                  <div className="w-10 h-10 rounded bg-tertiary/10 flex items-center justify-center border border-tertiary/30">
                    <Shield className="text-tertiary" size={20} />
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">{humanize(policy.scope)} Policy</h3>
                    <span className="font-mono text-label-sm text-on-surface-variant">{policy.id}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-xs">
                  <Chip tone={SCOPE_TONE[policy.scope]}>{policy.scope}</Chip>
                  <Chip tone={LEVEL_TONE[policy.securityLevel]}>{humanize(policy.securityLevel)}</Chip>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-sm">
                <div className="bg-surface-variant/50 p-sm rounded border border-outline-variant/50">
                  <span className="font-label-sm text-label-sm text-on-surface-variant block mb-xs">Model</span>
                  <span className="font-body-sm text-body-sm text-on-surface font-semibold flex items-center gap-xs">
                    <Cpu size={14} className="text-tertiary" />
                    {humanize(policy.model.provider)}
                  </span>
                  <span className="font-mono text-label-sm text-on-surface-variant block mt-xs">{policy.model.modelId}</span>
                </div>
                <div className="bg-surface-variant/50 p-sm rounded border border-outline-variant/50">
                  <span className="font-label-sm text-label-sm text-on-surface-variant block mb-xs">Cloud</span>
                  <span className="font-body-sm text-body-sm text-on-surface font-semibold">
                    {providerDisplay(policy.cloud.provider)}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant block mt-xs">
                    {policy.cloud.region} · {cloudModeDisplay(policy.cloud.mode)}
                  </span>
                </div>
                <div className="bg-surface-variant/50 p-sm rounded border border-outline-variant/50">
                  <span className="font-label-sm text-label-sm text-on-surface-variant block mb-xs">Token Budget</span>
                  <span className="font-body-sm text-body-sm text-on-surface font-semibold">
                    {formatTokens(policy.tokenBudget.maxTotalTokens)}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant block mt-xs">
                    On exhaustion: {humanize(policy.tokenBudget.onExhaustion)}
                  </span>
                </div>
                <div className="bg-surface-variant/50 p-sm rounded border border-outline-variant/50">
                  <span className="font-label-sm text-label-sm text-on-surface-variant block mb-xs">AI-First Default</span>
                  <span className="font-body-sm text-body-sm text-on-surface font-semibold">
                    {policy.aiFirstDefault ? 'Enabled' : 'Disabled'}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant block mt-xs">
                    Target: {policy.targetCompletionPercentDefault}% completion
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-xs">
                {LOCK_LABELS.map(({ key, label }) => {
                  const locked = policy.locks[key];
                  return (
                    <span
                      key={key}
                      className={`inline-flex items-center gap-xs px-2 py-1 rounded border font-label-sm text-label-sm ${
                        locked
                          ? 'bg-error/10 border-error/30 text-error'
                          : 'bg-surface-variant/50 border-outline-variant/50 text-on-surface-variant'
                      }`}
                    >
                      {locked ? <Lock size={12} /> : <LockOpen size={12} />}
                      {label}
                    </span>
                  );
                })}
              </div>

              <div className="mt-auto pt-md border-t border-outline-variant flex justify-between items-center">
                <span className="font-label-sm text-label-sm text-on-surface-variant">PII: {piiSummary(policy)}</span>
                <Link to="/pii-rules" className="text-tertiary font-label-md text-label-md hover:underline">
                  View Rules
                </Link>
              </div>

              {policy.scope === 'org' && <OrgPolicyEditor policy={policy} onSaved={reload} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
