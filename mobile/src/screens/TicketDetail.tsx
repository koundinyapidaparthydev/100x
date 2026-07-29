import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bot,
  Check,
  CheckCircle,
  Clock,
  FileCode,
  ShieldAlert,
  Tag,
  User,
  FileText,
} from 'lucide-react';
import { api } from '@shared/api';
import type { AiJobState } from '@shared/types';
import { cn } from '../lib/utils';
import { useAsync } from '../lib/useAsync';
import { formatTokens, timeAgo } from '../lib/format';
import { aiStatusChip, priorityChip } from '../lib/chips';
import { LoadingState, ErrorState } from '../components/States';
import { TrustStrip } from '../components/TrustStrip';

/** Display steps for the AI job lifecycle (docs: AI_DELEGATION.md). */
const LIFECYCLE_STEPS = ['queued', 'sanitizing', 'running', 'packaging', 'attaching', 'ready_for_human'] as const;

const STEP_LABELS: Record<(typeof LIFECYCLE_STEPS)[number], string> = {
  queued: 'Queued',
  sanitizing: 'Sanitizing PII',
  running: 'Running model',
  packaging: 'Packaging draft',
  attaching: 'Attaching to Jira',
  ready_for_human: 'Ready for human',
};

/** Index of the current state within the display lifecycle; -1 for terminal problem states. */
function lifecycleIndex(state: AiJobState): number {
  const normalized = state === 'enriching_mcp' ? 'running' : state;
  return LIFECYCLE_STEPS.indexOf(normalized as (typeof LIFECYCLE_STEPS)[number]);
}

export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, error, loading, retry } = useAsync(async () => {
    const workItem = await api.getWorkItem(id!);
    const job = workItem.lastAiJobId ? await api.getJob(workItem.lastAiJobId) : null;
    return { workItem, job };
  }, [id]);

  const [busyAction, setBusyAction] = useState<'ai' | 'human' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingState label="Loading ticket…" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <ErrorState error={error} onRetry={retry} />
      </div>
    );
  }

  const { workItem, job } = data;
  const priority = priorityChip(workItem.priority);
  const aiStatus = aiStatusChip(workItem.aiStatus);
  const currentStep = job ? lifecycleIndex(job.state) : -1;
  const blockedPii = workItem.aiStatus === 'blocked_pii';

  const sendTriage = async (aiFirst: boolean) => {
    setActionError(null);
    setBusyAction(aiFirst ? 'ai' : 'human');
    try {
      await api.triageWorkItem(
        workItem.id,
        aiFirst
          ? { aiFirst: true, targetCompletionPercent: workItem.targetCompletionPercent }
          : { aiFirst: false },
      );
      navigate('/app/triage');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Decision failed. Try again.');
      setBusyAction(null);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-background relative">
      <div className="flex-1 p-4 flex flex-col gap-4 pb-44 max-w-md mx-auto w-full">
        {/* PII blocked banner */}
        {blockedPii && (
          <button
            onClick={() =>
              navigate('/app/pii', {
                state: { categories: job?.piiReport.blocks ?? [], issueKey: workItem.board.issueKey },
              })
            }
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-warning-container text-on-warning-container text-left active:opacity-80 transition-opacity"
          >
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span className="font-body-sm">
              Blocked by the PII firewall before any model call. Tap to review.
            </span>
          </button>
        )}

        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-start gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 bg-tertiary-container text-on-tertiary-container rounded font-mono text-[10px] uppercase tracking-widest">
                  {workItem.board.issueKey}
                </span>
                <span className={cn('px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-widest', priority.className)}>
                  {priority.label}
                </span>
                <span className={cn('px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-widest', aiStatus.className)}>
                  {aiStatus.label}
                </span>
              </div>
              <h1 className="font-headline-md text-on-surface mt-1">{workItem.title}</h1>
            </div>
          </div>
          <div className="font-mono text-xs text-on-surface-variant flex flex-wrap gap-x-4 gap-y-1 mt-1">
            <span className="flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" /> {workItem.status}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Updated {timeAgo(workItem.updatedAt)}
            </span>
          </div>
        </div>

        {/* AI plan bento */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant flex flex-col gap-1">
            <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
              AI target
            </span>
            <span className="font-body-md text-on-surface font-medium flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              {workItem.aiFirst ? `${workItem.targetCompletionPercent}% AI-first` : 'Human-first'}
            </span>
          </div>
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant flex flex-col gap-1">
            <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
              Assignee proposal
            </span>
            <span className="font-body-md text-on-surface font-medium flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              {workItem.assigneeExternalId ?? 'Assign after AI draft'}
            </span>
          </div>
        </div>

        {/* Description */}
        <section className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant flex flex-col gap-2">
          <h2 className="font-sans font-semibold text-lg text-on-surface border-b border-outline-variant pb-2">
            Description
          </h2>
          <p className="font-body-sm text-on-surface-variant leading-relaxed">{workItem.description}</p>
          {workItem.labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {workItem.labels.map((label) => (
                <span
                  key={label}
                  className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-mono text-[10px]"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* AI lifecycle timeline */}
        <section className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant flex flex-col gap-3">
          <h2 className="font-sans font-semibold text-lg text-on-surface border-b border-outline-variant pb-2">
            AI lifecycle
          </h2>
          {!job ? (
            <p className="font-body-sm text-on-surface-variant">
              No AI job yet — approve the hand-off below (or swipe right in triage) to run AI first
              under policy.
            </p>
          ) : currentStep === -1 ? (
            <p className="font-body-sm text-on-surface-variant">
              Job {job.id} ended in state{' '}
              <span className="font-mono text-xs">{job.state}</span>
              {job.error ? `: ${job.error}` : '.'}
            </p>
          ) : (
            <ol className="flex flex-col gap-0">
              {LIFECYCLE_STEPS.map((step, idx) => {
                const done = idx < currentStep;
                const current = idx === currentStep;
                return (
                  <li key={step} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center border',
                          done && 'bg-primary-container border-primary text-on-primary-container',
                          current && 'bg-tertiary-container border-tertiary text-on-tertiary-container',
                          !done && !current && 'bg-surface-container-high border-outline-variant text-on-surface-variant',
                        )}
                      >
                        {done ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <span className={cn('w-1.5 h-1.5 rounded-full', current ? 'bg-tertiary animate-pulse' : 'bg-outline')} />
                        )}
                      </div>
                      {idx < LIFECYCLE_STEPS.length - 1 && (
                        <div className={cn('w-px h-5', done ? 'bg-primary' : 'bg-outline-variant')} />
                      )}
                    </div>
                    <span
                      className={cn(
                        'font-body-sm pt-0.5',
                        current ? 'text-on-surface font-semibold' : done ? 'text-on-surface-variant' : 'text-on-surface-variant/60',
                      )}
                    >
                      {STEP_LABELS[step]}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Token usage */}
        {job && (
          <section className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant flex flex-col gap-3">
            <h2 className="font-sans font-semibold text-lg text-on-surface border-b border-outline-variant pb-2">
              Token usage
            </h2>
            <div className="grid grid-cols-3 gap-2">
              <TokenStat label="Input" value={job.tokenUsage.input} />
              <TokenStat label="Output" value={job.tokenUsage.output} />
              <TokenStat label="Total" value={job.tokenUsage.total} highlight />
            </div>
            <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
              Model: {job.model.provider}/{job.model.modelId} • {job.cloudExecution.provider}{' '}
              {job.cloudExecution.region}
            </p>
          </section>
        )}

        {/* Artifacts */}
        {job && job.artifacts.length > 0 && (
          <section className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant flex flex-col gap-3">
            <h2 className="font-sans font-semibold text-lg text-on-surface border-b border-outline-variant pb-2">
              Artifacts
            </h2>
            <div className="flex flex-col gap-2">
              {job.artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant"
                >
                  {artifact.kind === 'patch' || artifact.kind === 'test_stub' ? (
                    <FileCode className="w-4 h-4 text-tertiary shrink-0 mt-0.5" />
                  ) : (
                    <FileText className="w-4 h-4 text-tertiary shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                        {artifact.kind.replace('_', ' ')}
                      </span>
                      <span className="font-mono text-[10px] text-on-surface-variant">
                        #{artifact.checksum.slice(0, 8)}
                      </span>
                    </div>
                    <p className="font-body-sm text-on-surface line-clamp-2">{artifact.preview}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* PII report */}
        {job && (job.piiReport.redactions > 0 || job.piiReport.blocks.length > 0) && (
          <section className="bg-warning-container/40 p-4 rounded-xl border border-warning flex flex-col gap-2">
            <h2 className="font-sans font-semibold text-lg text-on-surface flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-warning" /> PII report
            </h2>
            <p className="font-body-sm text-on-surface-variant">
              <span className="text-warning font-semibold">{job.piiReport.redactions}</span>{' '}
              redaction{job.piiReport.redactions === 1 ? '' : 's'} applied before the model ran.
            </p>
            {job.piiReport.blocks.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {job.piiReport.blocks.map((category) => (
                  <span
                    key={category}
                    className="px-2 py-0.5 rounded bg-warning-container text-on-warning-container font-mono text-[10px] uppercase tracking-widest"
                  >
                    {category}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {actionError && (
          <div className="px-3 py-2 rounded-lg bg-error-container text-on-error-container font-body-sm text-center">
            {actionError}
          </div>
        )}
      </div>

      {/* Fixed Bottom Action Area */}
      <div className="fixed bottom-0 left-0 w-full z-40">
        <div className="w-full bg-surface-container-lowest border-t border-outline-variant">
          <TrustStrip />
        </div>
        <div className="w-full bg-surface-container-lowest p-4 flex gap-3 border-t border-outline-variant pb-safe">
          <button
            onClick={() => void sendTriage(false)}
            disabled={busyAction !== null}
            className="flex-1 h-12 border border-outline text-on-surface rounded-lg font-sans font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {busyAction === 'human' ? 'Sending…' : 'Send human-first'}
          </button>
          <button
            onClick={() => void sendTriage(true)}
            disabled={busyAction !== null}
            className="flex-[2] h-12 bg-primary text-on-primary rounded-lg font-sans font-semibold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            <CheckCircle className="w-5 h-5" />
            {busyAction === 'ai' ? 'Approving…' : 'Approve hand-off'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TokenStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="bg-surface-container-low rounded-lg border border-outline-variant p-2 flex flex-col items-center">
      <span className={cn('font-mono text-sm font-semibold', highlight ? 'text-primary' : 'text-on-surface')}>
        {formatTokens(value)}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">{label}</span>
    </div>
  );
}
