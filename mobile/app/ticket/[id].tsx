import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { AiJob, AuditEvent, WorkItem } from '@shared/types';
import { api } from '@/src/api';
import {
  AsyncState,
  type CardTone,
  Card,
  colors,
  commonStyles,
  Field,
  formatTokens,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  Tag,
  timeAgo,
  useAsync,
} from '@/src/ui';

function priorityTone(priority: WorkItem['priority']): CardTone {
  if (priority === 'critical' || priority === 'high') return 'blush';
  if (priority === 'medium') return 'butter';
  return 'mint';
}

function jobTone(state: AiJob['state'] | undefined): CardTone {
  if (!state) return 'default';
  if (state === 'blocked_pii' || state === 'failed') return 'blush';
  if (state === 'ready_for_human') return 'butter';
  return 'mint';
}

function cloudLabel(job: AiJob): string {
  const custom = job.cloudExecution.customLabel;
  const provider = custom ?? job.cloudExecution.provider;
  return `${provider} · ${job.cloudExecution.region} · ${job.cloudExecution.mode.replaceAll('_', ' ')}`;
}

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const query = useAsync(async () => {
    const workItem = await api.getWorkItem(id);
    const job = workItem.lastAiJobId ? await api.getJob(workItem.lastAiJobId) : null;
    let transitions: AuditEvent[] = [];
    let securityLayers: number[] = [];
    try {
      const events = await api.listAuditEvents();
      const related = events.filter(
        (event) =>
          event.resource.id === workItem.id ||
          event.resource.id === workItem.board.issueKey ||
          (job && event.resource.id === job.id) ||
          (typeof event.metadata?.workItemId === 'string' && event.metadata.workItemId === workItem.id) ||
          (typeof event.metadata?.aiJobId === 'string' && job && event.metadata.aiJobId === job.id),
      );
      const layers = new Set<number>();
      for (const event of related) {
        for (const layer of event.securityLayersApplied) layers.add(layer);
      }
      securityLayers = [...layers].sort((a, b) => a - b);
      transitions = related
        .filter((event) => event.action.startsWith('job.state.'))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } catch {
      // Ticket details remain available if audit evidence cannot be loaded.
    }
    return { workItem, job, transitions, securityLayers };
  }, [id]);
  const [busy, setBusy] = useState(false);
  const [assignee, setAssignee] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const artifacts = query.data?.job?.artifacts ?? [];
    if (!artifacts.length) {
      setExpanded(null);
      return;
    }
    // Open the first draft so review context is visible without an extra tap.
    setExpanded(artifacts[0].id);
  }, [query.data?.job?.id, query.data?.job?.artifacts?.length]);

  const updateAssignee = async () => {
    if (!query.data) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateAssignee(query.data.workItem.id, assignee.trim() || null);
      setAssignee('');
      query.retry();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const triage = async (aiFirst: boolean) => {
    if (!query.data) return;
    setBusy(true);
    try {
      await api.triageWorkItem(
        query.data.workItem.id,
        aiFirst
          ? { aiFirst: true, targetCompletionPercent: query.data.workItem.targetCompletionPercent }
          : { aiFirst: false },
      );
      query.retry();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Decision failed');
    } finally {
      setBusy(false);
    }
  };

  const item = query.data?.workItem;
  const job = query.data?.job;
  const transitions = query.data?.transitions ?? [];
  const securityLayers = query.data?.securityLayers ?? [];
  const decided = item?.lastTriageDecision !== null;
  const piiBlocked = item?.aiStatus === 'blocked_pii' || job?.state === 'blocked_pii';
  const blockedCategories = job?.piiReport.blocks ?? [];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Ticket',
          headerLeft: () => (
            <Pressable
              testID="ticket-back-button"
              accessibilityRole="button"
              accessibilityLabel="Back to triage"
              onPress={() => router.back()}
              hitSlop={12}
              style={styles.backButton}
            >
              <Text style={styles.backLabel}>Back</Text>
            </Pressable>
          ),
        }}
      />
    <AsyncState loading={query.loading} error={query.error} onRetry={query.retry}>
      {item ? (
        <ScrollView
          testID="ticket-detail-screen"
          style={commonStyles.screen}
          contentContainerStyle={commonStyles.content}>
          {piiBlocked ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/pii',
                  params: {
                    workItemId: item.id,
                    issueKey: item.board.issueKey,
                    categories: blockedCategories.join(',') ?? '',
                  },
                })
              }>
              <Card tone="blush">
                <Text style={styles.warningText}>Blocked before model execution. Review the PII firewall.</Text>
                {blockedCategories.length ? (
                  <View style={styles.tagRow}>
                    {blockedCategories.map((block) => (
                      <Tag key={block} label={block.replaceAll('_', ' ')} tone="blush" />
                    ))}
                  </View>
                ) : null}
              </Card>
            </Pressable>
          ) : null}
          <PageHeader
            eyebrow={`${item.board.issueKey} · ${item.board.projectId}`}
            title={item.title}
            description={`Updated ${timeAgo(item.updatedAt)}`}
          />
          <View style={styles.tagRow}>
            <StatusBadge
              status={item.priority}
              label={item.priority}
              tone={item.priority === 'critical' || item.priority === 'high' ? 'danger' : item.priority === 'medium' ? 'warning' : 'info'}
            />
            <StatusBadge status={item.status} />
            {item.labels.map((label) => (
              <Tag key={label} label={label} tone="neutral" />
            ))}
          </View>

          <Card tone={priorityTone(item.priority)} testID="ticket-context-card">
            <Text style={commonStyles.heading}>Ticket context</Text>
            {piiBlocked ? (
              <>
                <Text style={commonStyles.body}>
                  Raw description stays on-device-hidden while this ticket is PII-blocked. Use the labels and
                  blocked categories to understand why the firewall stopped the run.
                </Text>
                <View style={styles.tagRow}>
                  {blockedCategories.length ? (
                    blockedCategories.map((block) => (
                      <Tag key={`ctx-${block}`} label={`Blocked · ${block.replaceAll('_', ' ')}`} tone="blush" />
                    ))
                  ) : (
                    <Tag label="Sensitive data blocked" tone="blush" />
                  )}
                  {item.labels.map((label) => (
                    <Tag key={`ctx-label-${label}`} label={label} tone="neutral" />
                  ))}
                </View>
              </>
            ) : (
              <Text style={commonStyles.body}>{item.description}</Text>
            )}
            <View style={styles.metaGrid}>
              <View style={styles.metaCell}>
                <Text style={commonStyles.meta}>Board status</Text>
                <Text style={styles.metaValue}>{item.status}</Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={commonStyles.meta}>AI target</Text>
                <Text style={styles.metaValue}>{item.targetCompletionPercent}%</Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={commonStyles.meta}>Assignee</Text>
                <Text style={styles.metaValue}>{item.assigneeExternalId ?? 'Unassigned'}</Text>
              </View>
            </View>
          </Card>

          <Card tone={jobTone(job?.state)} testID="ticket-job-card">
            <View style={styles.between}>
              <Text style={commonStyles.heading}>AI job</Text>
              {job ? <StatusBadge status={job.state} /> : <StatusBadge status="pending" label="Not started" />}
            </View>
            {!job ? (
              <Text style={commonStyles.body}>No AI job has started for this ticket yet.</Text>
            ) : (
              <>
                <Text style={commonStyles.body}>
                  {job.state === 'ready_for_human'
                    ? 'Draft is ready for human review. The model output is expanded below.'
                    : job.state === 'blocked_pii'
                      ? `The firewall stopped this job before the model ran${
                          blockedCategories.length
                            ? ` (${blockedCategories.map((block) => block.replaceAll('_', ' ')).join(', ')})`
                            : ''
                        }.`
                      : job.state === 'failed'
                        ? job.error ?? 'The job failed before producing a draft.'
                        : 'Job is still advancing through the pipeline. Token usage and artifacts update as stages complete.'}
                </Text>
                <View style={styles.metaGrid}>
                  <View style={styles.metaCell}>
                    <Text style={commonStyles.meta}>Model</Text>
                    <Text style={styles.metaValue}>{job.model.modelId}</Text>
                  </View>
                  <View style={styles.metaCell}>
                    <Text style={commonStyles.meta}>Provider</Text>
                    <Text style={styles.metaValue}>{job.model.provider}</Text>
                  </View>
                  <View style={styles.metaCell}>
                    <Text style={commonStyles.meta}>Started</Text>
                    <Text style={styles.metaValue}>{timeAgo(job.createdAt)}</Text>
                  </View>
                  <View style={styles.metaCell}>
                    <Text style={commonStyles.meta}>Finished</Text>
                    <Text style={styles.metaValue}>
                      {job.finishedAt ? timeAgo(job.finishedAt) : 'Still running'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.execution}>{cloudLabel(job)}</Text>
                {job.error ? <Text style={styles.errorInline}>{job.error}</Text> : null}
              </>
            )}
          </Card>

          {job?.artifacts.length ? (
            <>
              <Text style={styles.sectionLabel}>Review output</Text>
              <Text style={commonStyles.body}>
                Sanitized drafts the model produced for this ticket. Expand any card for the full body.
              </Text>
              {job.artifacts.map((artifact) => {
                const open = expanded === artifact.id;
                return (
                  <Pressable
                    key={artifact.id}
                    testID={`ticket-artifact-${artifact.id}`}
                    onPress={() => setExpanded(open ? null : artifact.id)}>
                    <Card tone="butter">
                      <View style={styles.between}>
                        <Text style={commonStyles.heading}>{artifact.kind.replaceAll('_', ' ')}</Text>
                        <Tag label={open ? 'Expanded' : 'Preview'} tone="butter" />
                      </View>
                      <Text style={commonStyles.body}>
                        {open ? artifact.content || artifact.preview : artifact.preview}
                      </Text>
                      <Text style={commonStyles.meta}>
                        {open ? 'Tap to collapse' : 'Tap to expand full draft'}
                      </Text>
                    </Card>
                  </Pressable>
                );
              })}
            </>
          ) : null}

          {job ? (
            <Card testID="ticket-tokens-card">
              <Text style={commonStyles.heading}>Token usage</Text>
              {job.tokenUsage.total === 0 ? (
                <Text style={commonStyles.body}>
                  {job.state === 'blocked_pii'
                    ? 'No tokens were spent — the firewall blocked the job before the model ran.'
                    : job.state === 'queued'
                      ? 'Waiting in queue. Input/output counts appear once the model starts.'
                      : 'Token counters update as the pipeline stages complete.'}
                </Text>
              ) : null}
              <View style={styles.tokenRow}>
                {(
                  [
                    ['Input', job.tokenUsage.input],
                    ['Output', job.tokenUsage.output],
                    ['Total', job.tokenUsage.total],
                  ] as const
                ).map(([label, value]) => (
                  <View key={label} style={styles.tokenCell}>
                    <Text style={commonStyles.meta}>{label}</Text>
                    <Text style={styles.tokenValue}>{formatTokens(value)}</Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {job ? (
            <Card tone={job.piiReport.blocks.length ? 'blush' : 'mint'} testID="ticket-pii-card">
              <Text style={commonStyles.heading}>PII report</Text>
              <Text style={commonStyles.body}>
                {job.piiReport.redactions} redaction{job.piiReport.redactions === 1 ? '' : 's'} applied before model
                execution.
              </Text>
              <View style={styles.tagRow}>
                {job.piiReport.blocks.length === 0 ? (
                  <Tag label="No blocked categories" tone="mint" />
                ) : (
                  job.piiReport.blocks.map((block) => (
                    <Tag key={block} label={block.replaceAll('_', ' ')} tone="blush" />
                  ))
                )}
              </View>
            </Card>
          ) : null}

          <Card tone={priorityTone(item.priority)}>
            <View style={styles.between}>
              <Text style={commonStyles.heading}>Current decision</Text>
              <StatusBadge
                status={
                  item.lastTriageDecision === null
                    ? 'pending'
                    : item.aiFirst
                      ? 'ai'
                      : 'human'
                }
                label={item.lastTriageDecision === null ? 'Needs triage' : undefined}
              />
            </View>
            <Text style={commonStyles.body}>
              {item.lastTriageDecision === null
                ? 'Choose whether to send this ticket to AI or assign it to a person.'
                : item.aiFirst
                  ? `${item.targetCompletionPercent}% target · AI should draft, then a human reviews.`
                  : `Assignee ${item.assigneeExternalId ?? 'not set'}`}
            </Text>
          </Card>

          {job && securityLayers.length > 0 ? (
            <Card>
              <Text style={commonStyles.heading}>Security layers</Text>
              <View style={styles.tagRow}>
                {securityLayers.map((layer) => (
                  <Tag key={layer} label={`Layer ${layer}`} tone="primary" />
                ))}
              </View>
            </Card>
          ) : null}

          <Card>
            <Text style={commonStyles.heading}>Assign to person</Text>
            <Field
              label="Engineer ID"
              value={assignee}
              onChangeText={setAssignee}
              placeholder="Engineer ID"
              autoCapitalize="none"
            />
            <SecondaryButton
              label={busy ? 'Assigning…' : 'Assign to person'}
              disabled={busy}
              onPress={() => void updateAssignee()}
            />
          </Card>

          <Card tone={job?.state === 'blocked_pii' ? 'blush' : job ? 'mint' : 'default'}>
            <Text style={commonStyles.heading}>Recorded lifecycle</Text>
            <Text style={commonStyles.body}>Only transitions returned by the audit log are shown.</Text>
            {!job ? <Text style={commonStyles.body}>No AI job has started.</Text> : null}
            {job && transitions.length === 0 ? (
              <Text style={commonStyles.body}>No audit transitions were returned for this job.</Text>
            ) : null}
            {transitions.map((event) => (
              <View key={event.id} style={styles.transition}>
                <StatusBadge status={event.action.replace('job.state.', '')} />
                <Text style={commonStyles.meta}>{timeAgo(event.createdAt)}</Text>
              </View>
            ))}
          </Card>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!decided ? (
            <View style={commonStyles.buttonRow}>
              <SecondaryButton
                grow
                label="Assign to person"
                disabled={busy}
                onPress={() => void triage(false)}
              />
              <PrimaryButton
                grow
                label="Send to AI"
                disabled={busy}
                onPress={() => void triage(true)}
              />
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </AsyncState>
    </>
  );
}

const styles = StyleSheet.create({
  backButton: { paddingHorizontal: 8, paddingVertical: 4 },
  backLabel: { color: colors.primary, fontSize: 17, fontWeight: '600' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  transition: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 10,
  },
  warningText: { color: colors.onBlush, fontWeight: '700' },
  error: { color: colors.danger, textAlign: 'center' },
  errorInline: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaCell: { minWidth: '28%', flexGrow: 1, gap: 2 },
  metaValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  execution: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  tokenRow: { flexDirection: 'row', gap: 10 },
  tokenCell: { flex: 1, gap: 2 },
  tokenValue: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sectionLabel: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 4 },
});
