import { ArrowRight, Check, Coins, Cpu, Download, Plus, ShieldCheck, ShieldX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api';
import type { AiJobState, PiiCategory, SecurityLevel } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import Chip, { type ChipTone } from '../components/Chip';
import { formatNumber, formatTokens, humanize, timeAgo } from '../lib/format';

const JOB_STATE_TONE: Record<AiJobState, ChipTone> = {
  running: 'tertiary',
  sanitizing: 'tertiary',
  enriching_mcp: 'tertiary',
  packaging: 'tertiary',
  attaching: 'tertiary',
  queued: 'surface',
  ready_for_human: 'primary',
  blocked_pii: 'warning',
  failed: 'error',
  cancelled: 'surface',
};

const SECURITY_POSTURE: Record<SecurityLevel, { level: number; label: string; desc: string }> = {
  standard: { level: 1, label: 'Standard Access', desc: 'Public data permissible. PII redaction enforced on all model calls.' },
  elevated: { level: 2, label: 'Restricted Access', desc: 'Internal data permissible. Strict PII redaction enabled. Financial data blocked.' },
  enterprise: { level: 3, label: 'Enterprise Lockdown', desc: 'Private endpoints only. All PII categories redacted or blocked before transmission.' },
  custom: { level: 4, label: 'Custom Posture', desc: 'Hand-tuned rules in effect. Review the PII rules page for exact category modes.' },
};

const FILTER_LABELS: Record<PiiCategory, string> = {
  email: 'Email Anonymization',
  phone: 'Phone Masking',
  ssn: 'SSN & ID Masking',
  credit_card: 'Card Data Guard',
  customer_name: 'Customer Name Shield',
};

export default function Dashboard() {
  const stats = useAsync(() => api.stats(), []);
  const jobs = useAsync(() => api.listJobs(), []);
  const policies = useAsync(() => api.listPolicies(), []);

  const policy = policies.data?.[0] ?? null;
  const posture = policy ? SECURITY_POSTURE[policy.securityLevel] : null;
  const piiEntries = policy ? (Object.entries(policy.pii) as [PiiCategory, string][]) : [];

  return (
    <div className="p-margin md:p-3xl max-w-container-max mx-auto w-full flex flex-col gap-xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md mb-md">
        <div>
          <h2 className="font-display-lg text-display-lg text-on-surface mb-xs">Command Center</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Real-time overview of AI delegation, compliance, and resource utilization.</p>
        </div>
        <div className="flex gap-md">
          <button className="px-md py-sm rounded border border-outline-variant bg-transparent text-on-surface hover:bg-surface-variant transition-colors font-label-md text-label-md flex items-center gap-sm">
            <Download size={18} />
            Export Report
          </button>
          <button className="px-md py-sm rounded bg-tertiary text-on-tertiary hover:bg-tertiary-fixed transition-colors font-label-md text-label-md flex items-center gap-sm font-bold cyan-glow">
            <Plus size={18} />
            New Delegation
          </button>
        </div>
      </div>

      {stats.loading && <LoadingState label="Loading command center…" />}
      {!stats.loading && stats.error && <ErrorState message={stats.error} onRetry={stats.reload} />}

      {!stats.loading && !stats.error && stats.data && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter auto-rows-[minmax(180px,auto)]">
          {/* KPI 1: Active Delegations */}
          <div className="glass-panel rounded-xl p-lg md:col-span-4 flex flex-col justify-between group hover:border-tertiary/50 transition-colors relative overflow-hidden">
            <div className="absolute top-0 right-0 p-md opacity-20 group-hover:opacity-40 transition-opacity">
              <Cpu size={64} className="text-tertiary" />
            </div>
            <div className="flex items-center justify-between z-10">
              <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Active Delegations</h3>
              <div className="flex items-center gap-xs px-2 py-1 rounded bg-tertiary/10 border border-tertiary/20 text-tertiary font-label-sm text-label-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
                Live
              </div>
            </div>
            <div className="z-10 mt-xl">
              <div className="flex items-baseline gap-sm">
                <span className="font-display-lg text-display-lg text-on-surface">{formatNumber(stats.data.activeJobs)}</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-sm">
                {formatNumber(stats.data.queuedJobs)} queued · {formatNumber(stats.data.readyForHuman)} awaiting review
              </p>
            </div>
          </div>

          {/* KPI 2: PII Interventions */}
          <div className="glass-panel rounded-xl p-lg md:col-span-4 flex flex-col justify-between group hover:border-error/50 transition-colors relative overflow-hidden">
            <div className="absolute top-0 right-0 p-md opacity-20 group-hover:opacity-40 transition-opacity">
              <ShieldX size={64} className="text-error" />
            </div>
            <div className="flex items-center justify-between z-10">
              <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">PII Interventions</h3>
              <div className="px-2 py-1 rounded bg-surface-variant text-on-surface-variant font-label-sm text-label-sm">
                Last 24h
              </div>
            </div>
            <div className="z-10 mt-xl">
              <div className="flex items-baseline gap-sm">
                <span className="font-display-lg text-display-lg text-on-surface">
                  {formatNumber(stats.data.piiBlocks24h + stats.data.piiRedactions24h)}
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-sm">
                {formatNumber(stats.data.piiBlocks24h)} blocks · {formatNumber(stats.data.piiRedactions24h)} redactions before transmission
              </p>
            </div>
          </div>

          {/* KPI 3: Token Burn */}
          <div className="glass-panel rounded-xl p-lg md:col-span-4 flex flex-col justify-between group hover:border-primary/50 transition-colors relative overflow-hidden">
            <div className="absolute top-0 right-0 p-md opacity-20 group-hover:opacity-40 transition-opacity">
              <Coins size={64} className="text-primary" />
            </div>
            <div className="flex items-center justify-between z-10">
              <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Token Burn Rate</h3>
              <div className="px-2 py-1 rounded bg-surface-variant text-on-surface-variant font-label-sm text-label-sm">
                vs Budget
              </div>
            </div>
            <div className="z-10 mt-xl">
              <div className="flex items-baseline gap-sm">
                <span className="font-display-lg text-display-lg text-on-surface">{formatTokens(stats.data.tokenUsageToday.total)}</span>
              </div>
              <div className="w-full bg-surface-dim h-1.5 rounded-full mt-md overflow-hidden flex">
                <div
                  className="bg-primary h-full rounded-l-full"
                  style={{ width: `${Math.min(100, Math.max(0, stats.data.tokenBudgetUsedPercent))}%` }}
                ></div>
                <div className="bg-surface-variant flex-1 h-full"></div>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-sm text-right">
                {stats.data.tokenBudgetUsedPercent}% of {formatTokens(stats.data.tokenBudget)} budget
              </p>
            </div>
          </div>

          {/* Delegation Compliance Matrix */}
          <div className="glass-panel rounded-xl p-lg md:col-span-8 md:row-span-2 flex flex-col">
            <div className="flex items-center justify-between mb-lg border-b border-outline-variant/30 pb-md">
              <div className="flex items-center gap-sm">
                <ShieldCheck className="text-on-surface" size={24} />
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Delegation Compliance Matrix</h3>
              </div>
              <Link to="/pii-rules" className="text-tertiary hover:text-tertiary-fixed text-label-md font-label-md flex items-center">
                Manage Rules <ArrowRight size={16} className="ml-xs" />
              </Link>
            </div>

            {policies.loading && <LoadingState label="Loading policy posture…" />}
            {!policies.loading && !policy && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Policy posture unavailable{policies.error ? ' — backend unreachable' : ''}. PII redaction remains enforced by the firewall.
              </p>
            )}
            {!policies.loading && policy && posture && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-xl flex-1">
                <div className="flex flex-col justify-center bg-surface-container-low p-md rounded border border-outline-variant/50">
                  <h4 className="font-label-md text-label-md text-on-surface-variant mb-md uppercase tracking-wide">Global Risk Posture</h4>
                  <div className="flex flex-col gap-lg">
                    <div className="flex items-end justify-between">
                      <span className="font-display-lg text-display-lg text-tertiary leading-none">Level {posture.level}</span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant mb-1">{posture.label}</span>
                    </div>
                    <div className="flex gap-xs w-full h-3">
                      {[1, 2, 3, 4].map((seg) => (
                        <div
                          key={seg}
                          className={`flex-1 ${seg === 1 ? 'rounded-l' : ''} ${seg === 4 ? 'rounded-r' : ''} ${
                            seg <= posture.level ? 'bg-tertiary cyan-glow' : 'bg-surface-variant'
                          }`}
                        ></div>
                      ))}
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{posture.desc}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-sm">
                  <h4 className="font-label-md text-label-md text-on-surface-variant mb-xs uppercase tracking-wide">Active Filters</h4>
                  {piiEntries.map(([category, mode]) => {
                    const active = mode !== 'allow';
                    return (
                      <div
                        key={category}
                        className="flex items-center justify-between p-sm rounded bg-surface-container-highest border border-outline-variant/30"
                      >
                        <div className="flex items-center gap-sm">
                          <ShieldCheck size={18} className={active ? 'text-tertiary' : 'text-on-surface-variant'} />
                          <span className={`font-body-sm text-body-sm ${active ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                            {FILTER_LABELS[category]}
                          </span>
                        </div>
                        <div className="flex items-center gap-sm">
                          <Chip tone={mode === 'block' ? 'error' : mode === 'hash' ? 'secondary' : mode === 'allow' ? 'warning' : 'tertiary'}>
                            {mode}
                          </Chip>
                          <div
                            className={`w-8 h-4 rounded-full relative border ${
                              active ? 'bg-tertiary/20 border-tertiary/50' : 'bg-surface-dim border-outline-variant'
                            }`}
                          >
                            <div
                              className={`absolute top-0 bottom-0 w-4 rounded-full ${
                                active ? 'right-0 bg-tertiary' : 'left-0 bg-surface-variant'
                              }`}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Active Jobs timeline */}
          <div className="glass-panel rounded-xl p-lg md:col-span-4 md:row-span-2 flex flex-col">
            <div className="flex items-center justify-between mb-lg border-b border-outline-variant/30 pb-md">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">Active Jobs</h3>
              <span className="px-2 py-0.5 rounded bg-surface-variant text-on-surface-variant font-label-sm text-label-sm">Live</span>
            </div>

            {jobs.loading && <LoadingState label="Loading jobs…" />}
            {!jobs.loading && jobs.error && (
              <div className="flex flex-col items-center gap-sm py-xl text-center">
                <p className="font-body-sm text-body-sm text-on-surface-variant">{jobs.error}</p>
                <button onClick={jobs.reload} className="text-tertiary font-label-md text-label-md hover:underline">
                  Retry
                </button>
              </div>
            )}
            {!jobs.loading && !jobs.error && jobs.data && jobs.data.length === 0 && (
              <EmptyState title="No AI jobs yet" body="Triage a work item to AI-first to start a delegation." />
            )}
            {!jobs.loading && !jobs.error && jobs.data && jobs.data.length > 0 && (
              <div className="flex-1 overflow-y-auto pr-sm -mr-sm space-y-md relative">
                <div className="absolute left-3 top-2 bottom-2 w-[2px] bg-outline-variant/30 z-0"></div>
                {jobs.data.slice(0, 8).map((job) => {
                  const tone = JOB_STATE_TONE[job.state];
                  const terminalDone = job.state === 'ready_for_human';
                  return (
                    <div key={job.id} className="relative z-10 flex gap-md">
                      <div
                        className={`w-6 h-6 rounded-full bg-surface-container-low border flex items-center justify-center shrink-0 mt-0.5 ${
                          tone === 'tertiary'
                            ? 'border-tertiary'
                            : tone === 'primary'
                              ? 'border-primary'
                              : tone === 'warning'
                                ? 'border-warning'
                                : tone === 'error'
                                  ? 'border-error'
                                  : 'border-outline-variant'
                        }`}
                      >
                        {terminalDone ? (
                          <Check size={14} className="text-primary" />
                        ) : (
                          <span
                            className={`w-2 h-2 rounded-full ${
                              tone === 'tertiary'
                                ? 'bg-tertiary animate-pulse'
                                : tone === 'warning'
                                  ? 'bg-warning'
                                  : tone === 'error'
                                    ? 'bg-error'
                                    : 'bg-surface-variant'
                            }`}
                          ></span>
                        )}
                      </div>
                      <Link
                        to={`/boards/task/${job.workItemId}`}
                        className="block w-full hover:bg-surface-container-low p-2 -m-2 rounded transition-colors"
                      >
                        <div className="flex items-center gap-sm mb-xs flex-wrap">
                          <Chip tone={tone} pulse={job.state === 'running'}>
                            {humanize(job.state)}
                          </Chip>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">{timeAgo(job.createdAt)}</span>
                        </div>
                        <h4 className="font-body-sm text-body-sm font-semibold text-on-surface font-mono">{job.workItemId}</h4>
                        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 line-clamp-2">
                          {job.model.modelId} · {formatTokens(job.tokenUsage.total)} tokens · {job.piiReport.redactions} redactions
                        </p>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
