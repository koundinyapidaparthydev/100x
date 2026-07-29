import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle,
  Cpu,
  FileCheck,
  Loader2,
  Lock,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@shared/api';
import type { AiJobState, AiStatus, WorkItem } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import Chip, { type ChipTone } from '../components/Chip';
import { cloudModeDisplay, formatTokens, humanize, providerDisplay, timeAgo } from '../lib/format';

const AI_STATUS_TONE: Record<AiStatus, ChipTone> = {
  none: 'surface',
  queued: 'surface',
  running: 'tertiary',
  ready_for_human: 'primary',
  blocked_pii: 'warning',
  failed: 'error',
  cancelled: 'surface',
};

const PRIORITY_TONE: Record<WorkItem['priority'], ChipTone> = {
  low: 'surface',
  medium: 'tertiary',
  high: 'warning',
  critical: 'error',
};

const TERMINAL_ERROR_STATES: AiJobState[] = ['blocked_pii', 'failed', 'cancelled'];

const PIPELINE: { key: AiJobState; label: string; desc: string }[] = [
  { key: 'queued', label: 'Task Queued', desc: 'Context gathered from the board.' },
  { key: 'sanitizing', label: 'PII Sanitization', desc: 'Firewall redacts and blocks sensitive data.' },
  { key: 'enriching_mcp', label: 'Context Enrichment', desc: 'MCP tools attach repo and document context.' },
  { key: 'running', label: 'Model Execution', desc: 'Model generates the delegation package.' },
  { key: 'packaging', label: 'Packaging Artifacts', desc: 'Drafts, patches, and notes are assembled.' },
  { key: 'attaching', label: 'Attaching to Board', desc: 'Artifacts are written back to the ticket.' },
  { key: 'ready_for_human', label: 'Ready for Human', desc: 'Package awaits engineer review.' },
];

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(async () => {
    const workItem = await api.getWorkItem(id!);
    const job = workItem.lastAiJobId ? await api.getJob(workItem.lastAiJobId) : null;
    return { workItem, job };
  }, [id]);

  const handleApprove = async () => {
    if (!id || !data) return;
    setActionPending(true);
    setActionError(null);
    try {
      await api.triageWorkItem(id, { aiFirst: true, targetCompletionPercent: data.workItem.targetCompletionPercent });
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionPending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingState label="Loading work item…" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background p-margin">
        <button
          onClick={() => navigate(-1)}
          className="p-sm hover:bg-surface-variant rounded-full text-on-surface-variant transition-colors mb-lg"
        >
          <ArrowLeft size={20} />
        </button>
        <ErrorState message={error ?? 'Work item not found'} onRetry={reload} />
      </div>
    );
  }

  const { workItem: wi, job } = data;
  const isTerminalError = job ? TERMINAL_ERROR_STATES.includes(job.state) : false;
  const currentStep = job ? PIPELINE.findIndex((s) => s.key === job.state) : -1;
  const effectiveStep = !job ? -1 : job.state === 'ready_for_human' ? PIPELINE.length : isTerminalError ? 1 : currentStep;

  return (
    <div className="font-body-md text-body-md antialiased min-h-screen bg-background">
      <header className="w-full flex items-center justify-between py-md px-margin border-b border-outline-variant bg-background sticky top-0 z-40">
        <div className="flex items-center gap-sm">
          <button
            onClick={() => navigate(-1)}
            className="p-sm hover:bg-surface-variant rounded-full text-on-surface-variant transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Project: {wi.board.projectId}
            </span>
            <h1 className="font-headline-sm text-headline-sm text-on-surface font-semibold flex items-center gap-xs">
              {wi.board.issueKey}
              <Lock size={16} className="text-tertiary" fill="currentColor" />
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-md">
          {wi.aiFirst && (
            <div className="flex items-center gap-xs bg-tertiary-container px-sm py-[2px] rounded border border-tertiary/30">
              <Sparkles size={14} className="text-tertiary" />
              <span className="font-label-sm text-label-sm text-tertiary">AI Managed</span>
            </div>
          )}
          <button className="px-md py-sm border border-outline-variant text-on-surface font-label-md text-label-md rounded hover:bg-surface-variant transition-colors">
            Reassign
          </button>
          <button
            onClick={handleApprove}
            disabled={actionPending}
            className="px-md py-sm bg-tertiary text-on-tertiary font-label-md text-label-md rounded font-bold hover:opacity-90 transition-opacity flex items-center gap-xs disabled:opacity-50"
          >
            {actionPending ? <Loader2 size={16} className="animate-spin" /> : null}
            {job ? 'Approve Output' : 'Start AI Delegation'}
            {!actionPending && <CheckCircle size={16} />}
          </button>
        </div>
      </header>

      {actionError && (
        <div className="max-w-container-max mx-auto px-margin pt-md">
          <p className="font-body-sm text-body-sm text-error">{actionError}</p>
        </div>
      )}

      <main className="max-w-container-max mx-auto p-margin grid grid-cols-1 lg:grid-cols-12 gap-lg pb-3xl">
        <div className="lg:col-span-8 flex flex-col gap-lg">
          {/* Header card */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-md">
            <div className="flex justify-between items-start gap-md">
              <div>
                <h2 className="font-headline-md text-headline-md font-semibold text-on-surface mb-xs">{wi.title}</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant max-w-2xl">{wi.description}</p>
              </div>
              <div className="flex items-center gap-sm shrink-0 flex-wrap justify-end">
                <Chip tone={PRIORITY_TONE[wi.priority]}>{humanize(wi.priority)} Priority</Chip>
                <Chip tone={AI_STATUS_TONE[wi.aiStatus]} pulse={wi.aiStatus === 'running'}>
                  {humanize(wi.aiStatus)}
                </Chip>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-md pt-md border-t border-outline-variant mt-sm">
              <div>
                <span className="font-label-sm text-label-sm text-on-surface-variant block mb-[2px]">Assignee</span>
                <div className="flex items-center gap-xs">
                  {wi.aiFirst ? (
                    <Cpu size={18} className="text-tertiary" />
                  ) : (
                    <div className="w-[18px] h-[18px] rounded-full bg-tertiary/15 border border-tertiary/40 flex items-center justify-center">
                      <span className="font-label-sm text-label-sm text-tertiary text-[8px]">
                        {(wi.assigneeExternalId ?? '?').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="font-body-sm text-body-sm text-on-surface">
                    {wi.aiFirst ? 'AI Agent' : (wi.assigneeExternalId ?? 'Unassigned')}
                  </span>
                </div>
              </div>
              <div>
                <span className="font-label-sm text-label-sm text-on-surface-variant block mb-[2px]">Board</span>
                <span className="font-body-sm text-body-sm text-on-surface font-mono">
                  {wi.board.type.toUpperCase()} · {wi.board.issueKey}
                </span>
              </div>
              <div>
                <span className="font-label-sm text-label-sm text-on-surface-variant block mb-[2px]">Target Completion</span>
                <span className="font-body-sm text-body-sm text-on-surface">{wi.targetCompletionPercent}%</span>
              </div>
              <div>
                <span className="font-label-sm text-label-sm text-on-surface-variant block mb-[2px]">Updated</span>
                <span className="font-body-sm text-body-sm text-on-surface">{timeAgo(wi.updatedAt)}</span>
              </div>
            </div>

            {wi.labels.length > 0 && (
              <div className="flex flex-wrap gap-xs pt-sm">
                {wi.labels.map((label) => (
                  <Chip key={label} tone="surface" className="normal-case">
                    {label}
                  </Chip>
                ))}
              </div>
            )}
          </div>

          {/* Artifacts */}
          <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface mt-sm border-b border-outline-variant pb-xs">
            Generated Artifacts
          </h3>
          {!job && (
            <EmptyState
              title="No AI job yet"
              body="Start an AI delegation to generate drafts, patches, and notes for this work item."
            />
          )}
          {job && job.artifacts.length === 0 && (
            <EmptyState title="No artifacts yet" body="Artifacts appear here once the job reaches the packaging stage." />
          )}
          {job && job.artifacts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              {job.artifacts.map((artifact) => (
                <div key={artifact.id} className="bg-surface-container border border-outline-variant rounded-xl flex flex-col overflow-hidden">
                  <div className="bg-surface-container-high border-b border-outline-variant px-md py-sm flex justify-between items-center">
                    <Chip tone="secondary">{humanize(artifact.kind)}</Chip>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">{artifact.storage.provider}</span>
                  </div>
                  <div className="p-md font-mono text-[11px] leading-tight text-on-surface-variant bg-surface-container-low h-[140px] overflow-hidden relative">
                    <pre>{artifact.preview}</pre>
                    <div className="absolute bottom-0 left-0 w-full h-[40px] bg-gradient-to-t from-surface-container-low to-transparent"></div>
                  </div>
                  <div className="px-md py-sm border-t border-outline-variant flex justify-between items-center bg-surface-container-lowest gap-md">
                    <span className="font-mono text-label-sm text-on-surface-variant truncate" title={artifact.checksum}>
                      sha: {artifact.checksum}
                    </span>
                    <Chip tone={artifact.boardAttachmentId ? 'primary' : 'surface'}>
                      {artifact.boardAttachmentId ? 'Attached' : 'Pending Attach'}
                    </Chip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 flex flex-col gap-lg">
          {/* AI Lifecycle */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col">
            <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface mb-md">AI Lifecycle</h3>
            {!job && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                No AI job has run for this item yet. Use the action above to enqueue one through the PII gate.
              </p>
            )}
            {job && (
              <>
                {isTerminalError && (
                  <div className="mb-md p-sm rounded border border-warning/40 bg-warning/10 flex items-start gap-sm">
                    <AlertTriangle size={16} className="text-warning shrink-0 mt-[2px]" />
                    <div>
                      <p className="font-label-md text-label-md text-warning uppercase">{humanize(job.state)}</p>
                      {job.error && <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs">{job.error}</p>}
                    </div>
                  </div>
                )}
                <div className="flex-1 relative">
                  <div className="absolute left-[11px] top-[16px] bottom-[32px] w-[2px] bg-outline-variant"></div>
                  <div className="flex flex-col gap-lg relative z-10">
                    {PIPELINE.map((step, i) => {
                      const done = i < effectiveStep || job.state === 'ready_for_human';
                      const active = i === effectiveStep && !isTerminalError && job.state !== 'ready_for_human';
                      return (
                        <div key={step.key} className={`flex gap-md ${!done && !active ? 'opacity-50' : ''}`}>
                          <div className="flex-shrink-0 mt-[4px]">
                            <div
                              className={`w-[24px] h-[24px] rounded-full flex items-center justify-center border-2 ${
                                done
                                  ? 'bg-surface-container-high border-primary'
                                  : active
                                    ? 'bg-tertiary/20 border-tertiary cyan-glow'
                                    : 'bg-surface-container border-outline-variant'
                              }`}
                            >
                              {done ? (
                                <Check size={14} className="text-primary" />
                              ) : active ? (
                                <span className="w-[8px] h-[8px] bg-tertiary rounded-full animate-ping"></span>
                              ) : null}
                            </div>
                          </div>
                          <div>
                            <h4 className={`font-label-md text-label-md ${active ? 'text-tertiary' : 'text-on-surface'}`}>{step.label}</h4>
                            <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs">{step.desc}</p>
                            {active && (
                              <span className="font-label-sm text-label-sm text-tertiary block mt-[2px]">In progress</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Token usage */}
          {job && (
            <div className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-md">
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">Token Usage</h3>
              <div className="flex flex-col gap-sm">
                {(
                  [
                    ['Input', job.tokenUsage.input],
                    ['Output', job.tokenUsage.output],
                    ['Total', job.tokenUsage.total],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="font-body-sm text-body-sm text-on-surface-variant">{label}</span>
                    <span className="font-mono text-body-sm text-on-surface">{formatTokens(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PII report */}
          {job && (
            <div className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-md">
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">PII Report</h3>
              <div className="flex justify-between items-center">
                <span className="font-body-sm text-body-sm text-on-surface-variant">Redactions applied</span>
                <span className="font-mono text-body-sm text-tertiary">{job.piiReport.redactions}</span>
              </div>
              <div className="flex flex-col gap-xs">
                <span className="font-body-sm text-body-sm text-on-surface-variant">Blocked categories</span>
                {job.piiReport.blocks.length === 0 ? (
                  <span className="font-body-sm text-body-sm text-on-surface">None — payload cleared the firewall.</span>
                ) : (
                  <div className="flex flex-wrap gap-xs">
                    {job.piiReport.blocks.map((block) => (
                      <Chip key={block} tone="warning">
                        {humanize(block)}
                      </Chip>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Delegation security / where this ran */}
          <div className="bg-surface-container-high border border-outline-variant rounded-xl overflow-hidden">
            <div className="p-md flex flex-col gap-sm">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md text-on-surface uppercase tracking-wider">Delegation Security</span>
                <Lock size={18} className="text-tertiary" fill="currentColor" />
              </div>
              <ul className="flex flex-col gap-xs mt-xs">
                <li className="flex items-center gap-sm">
                  <ShieldAlert size={14} className="text-tertiary" />
                  <span className="font-label-sm text-label-sm text-on-surface-variant">PII Redaction Active</span>
                </li>
                <li className="flex items-center gap-sm">
                  <FileCheck size={14} className="text-tertiary" />
                  <span className="font-label-sm text-label-sm text-on-surface-variant">No Prod Deployment Access</span>
                </li>
              </ul>
              {job && (
                <div className="flex flex-col gap-xs pt-sm border-t border-outline-variant/50 mt-xs">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Where this ran</span>
                  <span className="font-mono text-body-sm text-on-surface">{job.model.modelId}</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    {providerDisplay(job.cloudExecution.provider)} · {job.cloudExecution.region} ·{' '}
                    {cloudModeDisplay(job.cloudExecution.mode)}
                  </span>
                </div>
              )}
            </div>
            <div className="bg-primary-container px-md py-sm border-t border-primary/30 flex justify-between items-center">
              <span className="font-label-sm text-label-sm text-on-primary-container">Enterprise AI Governance</span>
              <span className="font-label-sm text-label-sm text-on-primary-container">
                {job ? job.cloudExecution.region : '—'}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
