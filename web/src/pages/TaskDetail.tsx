import { useState } from 'react';
import { Bot, UserRound } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '@shared/api';
import type { AiJob, AuditEvent, WorkItem } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import { humanize, timeAgo } from '../lib/format';
import { Button, CapabilityGate, PageContainer, PageHeader, StatusBadge } from '../components/ui';
import { WorkItemJobRail, WorkItemLifecycleRail, WorkItemReturnLink } from '../components/work';
import { readDemoSession } from '../lib/session';
import { parseWorkQueueFilter } from '../lib/workQueue';

const PRIORITY_TONE: Record<WorkItem['priority'], 'neutral' | 'info' | 'warning' | 'danger'> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
};

async function loadTaskDetail(id: string): Promise<{
  workItem: WorkItem;
  job: AiJob | null;
  securityLayers: number[];
  auditTransitions: AuditEvent[];
}> {
  const workItem = await api.getWorkItem(id);
  let job: AiJob | null = null;
  if (workItem.lastAiJobId) {
    job = await api.getJob(workItem.lastAiJobId);
  }

  let securityLayers: number[] = [];
  let auditTransitions: AuditEvent[] = [];
  try {
    const events = await api.listAuditEvents();
    const related = events.filter(
      (e: AuditEvent) =>
        e.resource.id === workItem.id ||
        e.resource.id === workItem.board.issueKey ||
        (job && e.resource.id === job.id) ||
        (typeof e.metadata?.workItemId === 'string' && e.metadata.workItemId === workItem.id) ||
        (typeof e.metadata?.aiJobId === 'string' && job && e.metadata.aiJobId === job.id),
    );
    const layers = new Set<number>();
    for (const e of related) {
      for (const layer of e.securityLayersApplied) layers.add(layer);
    }
    securityLayers = [...layers].sort((a, b) => a - b);
    auditTransitions = related
      .filter((event) => event.action.startsWith('job.state.'))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } catch {
    /* audit is best-effort for the security panel */
  }

  return { workItem, job, securityLayers, auditTransitions };
}

export default function TaskDetail() {
  const { id: legacyId, workItemId, projectId: routeProjectId } = useParams<{
    id?: string;
    workItemId?: string;
    projectId?: string;
  }>();
  const id = workItemId ?? legacyId;
  const [searchParams] = useSearchParams();
  const queueFilter = parseWorkQueueFilter(searchParams.get('filter'));
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const canManage = ['founder', 'manager'].includes(readDemoSession()?.role ?? '');

  const { data, loading, error, reload } = useAsync(() => loadTaskDetail(id!), [id]);

  const handleApprove = async () => {
    if (!id || !data) return;
    setActionPending(true);
    setActionError(null);
    try {
      await api.triageWorkItem(id, {
        aiFirst: true,
        targetCompletionPercent: data.workItem.targetCompletionPercent,
      });
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionPending(false);
    }
  };

  const handleHumanFirst = async () => {
    if (!id) return;
    setActionPending(true);
    setActionError(null);
    try {
      await api.triageWorkItem(id, { aiFirst: false });
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionPending(false);
    }
  };

  if (loading) {
    return (
      <PageContainer className="flex min-h-[50vh] items-center justify-center" width="detail">
        <LoadingState label="Loading work item…" />
      </PageContainer>
    );
  }

  if (error || !data) {
    return (
      <PageContainer width="detail">
        <ErrorState message={error ?? 'Work item not found'} onRetry={reload} />
      </PageContainer>
    );
  }

  const { workItem: wi, job, securityLayers, auditTransitions } = data;
  const projectId = routeProjectId ?? wi.board.projectId;
  const hasArtifacts = Boolean(job?.artifacts.length);

  return (
    <PageContainer width="detail" className="flex flex-col gap-6 font-body-md text-body-md antialiased" data-testid="task-detail-page">
      <WorkItemReturnLink projectId={projectId} filter={queueFilter} />

      <PageHeader
        eyebrow={
          <>
            <span data-testid="task-issue-key">{wi.board.issueKey}</span>
            {' · '}
            {wi.board.projectId}
          </>
        }
        title={wi.title}
        description={`${humanize(wi.priority)} priority · Updated ${timeAgo(wi.updatedAt)}`}
        actions={
          <>
            {wi.aiFirst && <StatusBadge status="ai" />}
            {wi.lastTriageDecision && (
              <span data-testid="task-triage-decision">
                <StatusBadge
                  status={wi.lastTriageDecision === 'ai_first' ? 'ai' : 'human'}
                  label={humanize(wi.lastTriageDecision)}
                />
              </span>
            )}
            <StatusBadge status={wi.aiStatus} />
            <CapabilityGate allowed={canManage}>
              {hasArtifacts ? (
                <Button onClick={() => document.getElementById('generated-artifacts')?.scrollIntoView({ behavior: 'smooth' })}>
                  Review output
                </Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={handleHumanFirst} loading={actionPending} data-testid="task-human-first">
                    <UserRound size={16} /> Assign to person
                  </Button>
                  {!job && (
                    <Button onClick={handleApprove} loading={actionPending} data-testid="task-ai-first">
                      <Bot size={16} /> Send to AI
                    </Button>
                  )}
                </>
              )}
            </CapabilityGate>
          </>
        }
      />

      {actionError && (
        <p className="font-body-sm text-body-sm text-error" data-testid="task-action-error">
          {actionError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-lg pb-3xl lg:grid-cols-12">
        <div className="flex flex-col gap-lg lg:col-span-8">
          <section className="flex flex-col gap-md rounded-xl border border-outline-variant bg-surface-container p-lg">
            <div className="flex flex-wrap items-start justify-between gap-md">
              <div className="min-w-0">
                <h2 className="mb-xs text-sm font-semibold uppercase tracking-[0.06em] text-on-surface-variant">Ticket</h2>
                <p className="max-w-2xl whitespace-pre-wrap text-sm text-on-surface">{wi.description}</p>
              </div>
              <StatusBadge status={wi.priority} tone={PRIORITY_TONE[wi.priority]} label={`${humanize(wi.priority)} priority`} />
            </div>

            <div className="mt-sm grid grid-cols-2 gap-md border-t border-outline-variant pt-md md:grid-cols-4">
              <div>
                <span className="mb-[2px] block font-label-sm text-label-sm text-on-surface-variant">Assignee</span>
                <div className="flex items-center gap-xs">
                  {wi.aiFirst ? (
                    <Bot size={18} className="text-primary" />
                  ) : (
                    <div className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-tertiary/40 bg-tertiary/15">
                      <span className="font-label-sm text-[8px] text-label-sm text-tertiary">
                        {(wi.assigneeExternalId ?? '?').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="font-body-sm text-body-sm text-on-surface">
                    {wi.aiFirst ? 'AI job' : (wi.assigneeExternalId ?? 'Unassigned')}
                  </span>
                </div>
              </div>
              <div>
                <span className="mb-[2px] block font-label-sm text-label-sm text-on-surface-variant">Board</span>
                <span className="font-body-sm font-mono text-body-sm text-on-surface">
                  {wi.board.type.toUpperCase()} · {wi.board.issueKey}
                </span>
              </div>
              <div>
                <span className="mb-[2px] block font-label-sm text-label-sm text-on-surface-variant">Target completion</span>
                <span className="font-body-sm text-body-sm text-on-surface">{wi.targetCompletionPercent}%</span>
              </div>
              <div>
                <span className="mb-[2px] block font-label-sm text-label-sm text-on-surface-variant">Status</span>
                <span className="font-body-sm text-body-sm text-on-surface">{wi.status}</span>
              </div>
            </div>

            {wi.labels.length > 0 && (
              <div className="flex flex-wrap gap-xs pt-sm">
                {wi.labels.map((label) => (
                  <StatusBadge key={label} status={label} label={label} />
                ))}
              </div>
            )}
          </section>

          <h3
            id="generated-artifacts"
            className="mt-sm border-b border-outline-variant pb-xs font-headline-sm text-headline-sm font-semibold text-on-surface"
          >
            Generated output
          </h3>
          {!job && (
            <EmptyState title="No AI job yet" body="Send this work item to AI to generate reviewable output." />
          )}
          {job && job.artifacts.length === 0 && (
            <EmptyState
              title="No artifacts yet"
              body={
                job.state === 'blocked_pii'
                  ? 'Job was blocked by the PII firewall before packaging. See the PII report.'
                  : 'Artifacts appear here once the job reaches the packaging stage.'
              }
            />
          )}
          {job && job.artifacts.length > 0 && (
            <div className="grid grid-cols-1 gap-md">
              {job.artifacts.map((artifact) => (
                <div key={artifact.id} className="flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container">
                  <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-high px-md py-sm">
                    <StatusBadge status={artifact.kind} label={humanize(artifact.kind)} />
                    <span className="font-label-sm text-label-sm text-on-surface-variant">{artifact.storage.provider}</span>
                  </div>
                  <div className="max-h-[420px] overflow-auto bg-surface-container-low p-md font-mono text-[12px] leading-relaxed text-on-surface">
                    <pre className="whitespace-pre-wrap break-words">{artifact.content || artifact.preview}</pre>
                  </div>
                  <div className="flex items-center justify-between gap-md border-t border-outline-variant bg-surface-container-lowest px-md py-sm">
                    <span className="truncate font-mono text-label-sm text-on-surface-variant" title={artifact.checksum}>
                      sha: {artifact.checksum}
                    </span>
                    <StatusBadge
                      status={artifact.boardAttachmentId ? 'attached' : 'pending'}
                      tone={artifact.boardAttachmentId ? 'success' : 'neutral'}
                      label={artifact.boardAttachmentId ? 'Attached' : 'Not attached'}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-lg lg:col-span-4">
          <WorkItemLifecycleRail job={job} auditTransitions={auditTransitions} />
          {job && <WorkItemJobRail job={job} securityLayers={securityLayers} />}
        </aside>
      </div>
    </PageContainer>
  );
}
