import { useEffect, useMemo, useState } from 'react';
import { CreditCard, Fingerprint, Mail, Phone, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@shared/api';
import {
  normalizeCustomerNames,
  normalizePiiMap,
  stylesForCategory,
} from '@shared/piiPolicy';
import type {
  PiiCategory,
  PiiCategoryRule,
  PiiMode,
  PiiRedactionStyle,
  Policy,
} from '@shared/types';
import GovernanceNav from '../components/GovernanceNav';
import { useAsync } from '../lib/useAsync';
import { AsyncBoundary, Card, Field, PageContainer, PageHeader, SaveBar, StatusBadge } from '../components/ui';
import { humanize } from '../lib/format';
import { readDemoSession } from '../lib/session';

const CATEGORY_META: Record<PiiCategory, { icon: LucideIcon; blurb: string }> = {
  email: { icon: Mail, blurb: 'Email-like patterns in the ticket title and description.' },
  phone: { icon: Phone, blurb: 'Recognized phone-number patterns in the ticket title and description.' },
  ssn: { icon: Fingerprint, blurb: 'US Social Security number patterns in the ticket title and description.' },
  credit_card: { icon: CreditCard, blurb: 'Payment-card candidates that pass a checksum (PCI). Title and description only.' },
  customer_name: { icon: User, blurb: 'Names listed below, matched on word boundaries in the ticket title and description.' },
};

const CATEGORY_ORDER: PiiCategory[] = ['email', 'phone', 'ssn', 'credit_card', 'customer_name'];
const PII_MODES: PiiMode[] = ['redact', 'block', 'hash', 'allow'];

const MODE_DESC: Record<PiiMode, string> = {
  redact: 'Clear recognized values using the style below before the model call.',
  block: 'Stop the AI job when this category is recognized.',
  hash: 'Replace recognized values with a shortened SHA-256 correlation value before the model call.',
  allow: 'Pass recognized values to the configured model unchanged.',
};

const STYLE_DESC: Record<PiiRedactionStyle, string> = {
  placeholder: 'Replace with [EMAIL_1], [PHONE_1], …',
  fixed: 'Replace every match with a specific cleared value you choose.',
  mask_keep_last: 'Mask digits but keep the last N (e.g. ***-***-0132 or ****1111).',
  mask_keep_domain: 'Keep the domain only (***@acme.com).',
};

const STYLE_LABEL: Record<PiiRedactionStyle, string> = {
  placeholder: 'Placeholder token',
  fixed: 'Fixed replacement',
  mask_keep_last: 'Keep last digits',
  mask_keep_domain: 'Keep email domain',
};

interface DraftState {
  pii: Record<PiiCategory, PiiCategoryRule>;
  customerNames: string[];
}

function previewFor(category: PiiCategory, rule: PiiCategoryRule): string {
  if (rule.mode === 'block') return 'Job blocked — value never sent to AI';
  if (rule.mode === 'allow') return 'Passed through unchanged';
  if (rule.mode === 'hash') return 'a1b2c3d4e5f6 (example hash)';
  const style = rule.style ?? 'placeholder';
  switch (style) {
    case 'fixed':
      return rule.fixedReplacement?.trim() || `[${category.toUpperCase()}_1]`;
    case 'mask_keep_last': {
      const n = rule.keepLastDigits ?? 4;
      if (category === 'phone') return `***-***-${'0'.repeat(Math.max(0, 4 - n))}${'1'.repeat(Math.min(n, 4))}`.slice(0, 12);
      if (category === 'credit_card') return `**** **** **** ${'1'.repeat(Math.min(n, 4)).padStart(4, '1')}`;
      if (category === 'ssn') return `***-**-${'1'.repeat(Math.min(n, 4)).padStart(4, '0')}`;
      return `****${'1'.repeat(n)}`;
    }
    case 'mask_keep_domain':
      return '***@acme.com';
    default:
      return `[${category === 'credit_card' ? 'CREDIT_CARD' : category.toUpperCase()}_1]`;
  }
}

export default function PiiRules() {
  const canManage = ['founder', 'manager'].includes(readDemoSession()?.role ?? '');
  const { data: policies, loading, error, reload } = useAsync(() => api.listPolicies(), []);
  const policy = policies?.find((item) => item.scope === 'org') ?? policies?.[0] ?? null;
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [namesText, setNamesText] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!policy) return;
    const pii = normalizePiiMap(policy.pii);
    const customerNames = normalizeCustomerNames(policy.customerNames);
    setDraft({ pii, customerNames });
    setNamesText(customerNames.join('\n'));
  }, [policy]);

  const baseline = useMemo(() => {
    if (!policy) return null;
    return {
      pii: normalizePiiMap(policy.pii),
      customerNames: normalizeCustomerNames(policy.customerNames),
    };
  }, [policy]);

  const dirty = useMemo(() => {
    if (!draft || !baseline) return false;
    return JSON.stringify(draft) !== JSON.stringify(baseline);
  }, [draft, baseline]);

  const changeMode = (category: PiiCategory, mode: PiiMode) => {
    if (!canManage) return;
    if (mode === 'allow' && draft?.pii[category].mode !== 'allow') {
      const confirmed = window.confirm(
        `Allow ${humanize(category)}?\n\nRecognized values in this category will be sent to the configured model unchanged. Detection is pattern-based and may not identify every sensitive value.`,
      );
      if (!confirmed) return;
    }
    setMessage(null);
    setDraft((current) =>
      current
        ? {
            ...current,
            pii: {
              ...current.pii,
              [category]: { ...current.pii[category], mode },
            },
          }
        : current,
    );
  };

  const changeStyle = (category: PiiCategory, style: PiiRedactionStyle) => {
    if (!canManage) return;
    setMessage(null);
    setDraft((current) =>
      current
        ? {
            ...current,
            pii: {
              ...current.pii,
              [category]: { ...current.pii[category], style },
            },
          }
        : current,
    );
  };

  const changeRuleField = (
    category: PiiCategory,
    patch: Partial<Pick<PiiCategoryRule, 'fixedReplacement' | 'keepLastDigits'>>,
  ) => {
    if (!canManage) return;
    setMessage(null);
    setDraft((current) =>
      current
        ? {
            ...current,
            pii: {
              ...current.pii,
              [category]: { ...current.pii[category], ...patch },
            },
          }
        : current,
    );
  };

  const save = async (p: Policy) => {
    if (!draft || !canManage) return;
    setSaving(true);
    setMessage(null);
    try {
      const customerNames = normalizeCustomerNames(namesText.split(/\n|,/));
      await api.updatePolicy(p.id, { pii: draft.pii, customerNames });
      setMessage('PII / PCI clearing rules saved.');
      reload();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'PII rules could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    if (!policy || !baseline) return;
    setDraft({
      pii: { ...baseline.pii },
      customerNames: [...baseline.customerNames],
    });
    setNamesText(baseline.customerNames.join('\n'));
    setMessage(null);
  };

  return (
    <PageContainer width="form" className="flex flex-col gap-6" data-testid="pii-rules-page">
      <PageHeader
        eyebrow="Governance / Policy workspace"
        title="PII & PCI clearing"
        description="Choose how each sensitive category is cleared from data shared with AI — fixed email, last digits of phone or card, placeholders, or hard block."
        actions={<StatusBadge status="warning" tone="warning" label="Pattern-based detection" />}
      />

      <GovernanceNav />
      {!canManage && (
        <p className="rounded-card border border-butter/20 bg-butter-container px-3 py-2 text-sm text-on-butter-container">
          Your role can review PII rules but cannot change them.
        </p>
      )}

      <Card tone="butter" title="What this check covers">
        <p className="text-sm leading-6 opacity-90">
          Before every model call, the backend clears supported patterns in the ticket title, description, and MCP
          context using these rules. Board write-back is scanned again so drafts do not echo raw values. Comments and
          attachments are not scanned yet. Audit events store category names and counts — never the matched values.
        </p>
      </Card>

      <AsyncBoundary
        loading={loading}
        error={error}
        empty={!loading && !error && !policy}
        loadingLabel="Loading PII rules…"
        emptyTitle="No policy configured"
        emptyBody="PII rules become available when an organization policy exists."
        onRetry={reload}
      >
        {policy && draft && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {CATEGORY_ORDER.map((category) => {
                const rule = draft.pii[category];
                const meta = CATEGORY_META[category];
                const Icon = meta.icon;
                const styles = stylesForCategory(category);
                const showClearing = rule.mode === 'redact';
                return (
                  <Card key={category} className="flex flex-col" data-testid={`pii-card-${category}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container">
                          <Icon className="text-on-surface-variant" size={20} />
                        </div>
                        <h2 className="font-semibold text-on-surface">{humanize(category)}</h2>
                      </div>
                      <StatusBadge status={rule.mode} />
                    </div>
                    <p className="mt-3 min-h-12 text-sm leading-5 text-on-surface-variant">{meta.blurb}</p>

                    <label className="mt-4 block text-sm font-medium text-on-surface">
                      Handling
                      <select
                        className="mt-1.5 min-h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                        value={rule.mode}
                        disabled={!canManage}
                        data-testid={`pii-mode-${category}`}
                        onChange={(event) => changeMode(category, event.target.value as PiiMode)}
                      >
                        {PII_MODES.map((m) => (
                          <option key={m} value={m}>{humanize(m)}</option>
                        ))}
                      </select>
                    </label>
                    <p className="mt-2 text-xs leading-5 text-on-surface-variant">{MODE_DESC[rule.mode]}</p>

                    {showClearing && (
                      <div className="mt-4 space-y-3 border-t border-outline-variant pt-3">
                        <label className="block text-sm font-medium text-on-surface">
                          Clear as
                          <select
                            className="mt-1.5 min-h-10 w-full rounded-lg border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                            value={rule.style ?? styles[0]}
                            disabled={!canManage}
                            data-testid={`pii-style-${category}`}
                            onChange={(event) => changeStyle(category, event.target.value as PiiRedactionStyle)}
                          >
                            {styles.map((s) => (
                              <option key={s} value={s}>{STYLE_LABEL[s]}</option>
                            ))}
                          </select>
                        </label>
                        <p className="text-xs leading-5 text-on-surface-variant">
                          {STYLE_DESC[rule.style ?? styles[0]!]}
                        </p>

                        {(rule.style ?? styles[0]) === 'fixed' && (
                          <Field
                            label="Replacement value"
                            value={rule.fixedReplacement ?? ''}
                            disabled={!canManage}
                            data-testid={`pii-fixed-${category}`}
                            placeholder={
                              category === 'email'
                                ? 'user@cleared.invalid'
                                : category === 'phone'
                                  ? '000-000-0000'
                                  : 'CLEARED'
                            }
                            onChange={(event) =>
                              changeRuleField(category, { fixedReplacement: event.target.value })
                            }
                          />
                        )}

                        {(rule.style ?? styles[0]) === 'mask_keep_last' && (
                          <Field
                            label="Digits to keep"
                            type="number"
                            min={0}
                            max={8}
                            value={rule.keepLastDigits ?? 4}
                            disabled={!canManage}
                            data-testid={`pii-keep-last-${category}`}
                            onChange={(event) =>
                              changeRuleField(category, {
                                keepLastDigits: Number(event.target.value) || 0,
                              })
                            }
                          />
                        )}

                        <p
                          className="rounded-lg bg-surface-container px-3 py-2 font-mono text-xs text-on-surface"
                          data-testid={`pii-preview-${category}`}
                        >
                          Example → {previewFor(category, rule)}
                        </p>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            <Card title="Customer names to clear" data-testid="pii-customer-names">
              <p className="mb-3 text-sm text-on-surface-variant">
                One name per line. Matched on word boundaries when customer_name mode is redact, hash, or block.
              </p>
              <textarea
                className="min-h-28 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-surface-container"
                value={namesText}
                disabled={!canManage}
                data-testid="pii-customer-names-input"
                placeholder={'Jane Doe\nJohn Smith'}
                onChange={(event) => {
                  if (!canManage) return;
                  setMessage(null);
                  const next = event.target.value;
                  setNamesText(next);
                  setDraft((current) =>
                    current
                      ? { ...current, customerNames: normalizeCustomerNames(next.split(/\n|,/)) }
                      : current,
                  );
                }}
              />
            </Card>

            {message && <p className="text-sm text-on-surface-variant" data-testid="pii-save-message">{message}</p>}
            <SaveBar
              dirty={dirty && canManage}
              saving={saving}
              message="PII / PCI clearing has unsaved changes."
              onSave={() => void save(policy)}
              onDiscard={discard}
            />
          </>
        )}
      </AsyncBoundary>
    </PageContainer>
  );
}
