import { CreditCard, Fingerprint, Lock, LockOpen, Mail, Phone, ShieldAlert, ShieldCheck, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '@shared/api';
import type { PiiCategory, PiiMode } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import Chip, { type ChipTone } from '../components/Chip';
import { humanize } from '../lib/format';

const CATEGORY_META: Record<PiiCategory, { icon: LucideIcon; blurb: string }> = {
  email: { icon: Mail, blurb: 'Email addresses in ticket bodies, comments, and attachments.' },
  phone: { icon: Phone, blurb: 'Phone numbers, including international dialing formats.' },
  ssn: { icon: Fingerprint, blurb: 'Social Security Numbers and national ID patterns.' },
  credit_card: { icon: CreditCard, blurb: 'Card PANs, last-4 references, and expiry data.' },
  customer_name: { icon: User, blurb: 'Customer names and configured account identifiers.' },
};

const CATEGORY_ORDER: PiiCategory[] = ['email', 'phone', 'ssn', 'credit_card', 'customer_name'];

const MODE_TONE: Record<PiiMode, ChipTone> = {
  redact: 'tertiary',
  block: 'error',
  hash: 'secondary',
  allow: 'warning',
};

const MODE_DESC: Record<PiiMode, string> = {
  redact: 'Replaced with placeholders before any model call.',
  block: 'Hard-stops the AI job until the data is removed.',
  hash: 'Irreversibly hashed; models see stable pseudonyms.',
  allow: 'Permitted through the firewall with full audit logging.',
};

const LOCK_LABELS: { key: 'models' | 'securityMin' | 'cloud'; label: string }[] = [
  { key: 'models', label: 'Models' },
  { key: 'securityMin', label: 'Security Minimum' },
  { key: 'cloud', label: 'Cloud' },
];

export default function PiiRules() {
  const { data: policies, loading, error, reload } = useAsync(() => api.listPolicies(), []);
  const policy = policies?.[0] ?? null;

  return (
    <div className="max-w-container-max mx-auto p-margin flex flex-col gap-xl">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-semibold text-on-surface">PII Rules</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-sm max-w-2xl">
            Category-level field maps enforced by the PII firewall before any context reaches a model.
          </p>
        </div>
      </div>

      {/* Trust banner */}
      <div className="bg-tertiary-container/20 border border-tertiary/30 rounded-xl p-lg flex items-start gap-md">
        <div className="w-10 h-10 rounded bg-tertiary/10 border border-tertiary/30 flex items-center justify-center shrink-0">
          <ShieldCheck className="text-tertiary" size={20} />
        </div>
        <div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">PII never reaches models unsanitized</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs max-w-3xl">
            Every AI job passes through the sanitization gate first. Depending on the mode below, matched data is
            redacted, hashed, or hard-blocked before a single token is transmitted — and every intervention is
            recorded in the audit log.
          </p>
        </div>
      </div>

      {loading && <LoadingState label="Loading PII rules…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && !policy && (
        <EmptyState
          icon={<ShieldAlert size={22} />}
          title="No policy configured"
          body="Create a policy to define how each PII category is handled by the firewall."
        />
      )}

      {!loading && !error && policy && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-lg">
            {CATEGORY_ORDER.map((category) => {
              const mode = policy.pii[category];
              const meta = CATEGORY_META[category];
              const Icon = meta.icon;
              return (
                <div
                  key={category}
                  className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-md hover:border-tertiary/50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-sm">
                      <div className="w-10 h-10 rounded bg-surface-variant flex items-center justify-center border border-outline-variant">
                        <Icon className="text-tertiary" size={20} />
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface">{humanize(category)}</h3>
                    </div>
                    <Chip tone={MODE_TONE[mode]}>{mode}</Chip>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{meta.blurb}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-auto pt-md border-t border-outline-variant">
                    {MODE_DESC[mode]}
                  </p>
                </div>
              );
            })}

            {/* Policy posture card */}
            <div className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-md">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-sm">
                  <div className="w-10 h-10 rounded bg-surface-variant flex items-center justify-center border border-outline-variant">
                    <ShieldAlert className="text-secondary" size={20} />
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Policy Posture</h3>
                </div>
                <Chip tone="primary">{humanize(policy.securityLevel)}</Chip>
              </div>
              <div className="flex flex-col gap-xs">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Source Policy</span>
                <span className="font-mono text-body-sm text-on-surface">{policy.id}</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">{humanize(policy.scope)} scope</span>
              </div>
              <div className="mt-auto pt-md border-t border-outline-variant flex flex-col gap-sm">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Founder Locks</span>
                <div className="flex flex-wrap gap-sm">
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
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
