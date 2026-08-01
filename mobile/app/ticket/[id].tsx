import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { AuditEvent, WorkItem } from '@shared/types';
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

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const query = useAsync(async () => {
    const workItem = await api.getWorkItem(id);
    const job = workItem.lastAiJobId ? await api.getJob(workItem.lastAiJobId) : null;
    let transitions: AuditEvent[] = [];
    try {
      const events = await api.listAuditEvents();
      transitions = events
        .filter((event) => job && event.resource.id === job.id && event.action.startsWith('job.state.'))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } catch {
      // Ticket details remain available if audit evidence cannot be loaded.
    }
    return { workItem, job, transitions };
  }, [id]);
  const [busy, setBusy] = useState(false);
  const [assignee, setAssignee] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  const decided = item?.lastTriageDecision !== null;
  return (
    <AsyncState loading={query.loading} error={query.error} onRetry={query.retry}>
      {item ? (
        <ScrollView
          testID="ticket-detail-screen"
          style={commonStyles.screen}
          contentContainerStyle={commonStyles.content}>
          {item.aiStatus === 'blocked_pii' ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/pii',
                  params: {
                    workItemId: item.id,
                    issueKey: item.board.issueKey,
                    categories: job?.piiReport.blocks.join(',') ?? '',
                  },
                })
              }>
              <Card tone="blush">
                <Text style={styles.warningText}>Blocked before model execution. Review the PII firewall.</Text>
              </Card>
            </Pressable>
          ) : null}
          <PageHeader
            eyebrow={item.board.issueKey}
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
                  ? `${item.targetCompletionPercent}% target`
                  : `Assignee ${item.assigneeExternalId ?? 'not set'}`}
            </Text>
          </Card>
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
          <Card>
            <Text style={commonStyles.heading}>Description</Text>
            <Text style={commonStyles.body}>
              {item.aiStatus === 'blocked_pii'
                ? 'Description hidden on device while this ticket is PII-blocked.'
                : item.description}
            </Text>
          </Card>
          <Card tone={job?.state === 'blocked_pii' ? 'blush' : job ? 'mint' : 'default'}>
            <Text style={commonStyles.heading}>Recorded lifecycle</Text>
            <Text style={commonStyles.body}>Only transitions returned by the audit log are shown.</Text>
            {!job ? <Text style={commonStyles.body}>No AI job has started.</Text> : null}
            {job && transitions.length === 0 ? <Text style={commonStyles.body}>No audit transitions were returned for this job.</Text> : null}
            {transitions.map((event) => (
              <View key={event.id} style={styles.transition}>
                <StatusBadge status={event.action.replace('job.state.', '')} />
                <Text style={commonStyles.meta}>{timeAgo(event.createdAt)}</Text>
              </View>
            ))}
            {job ? (
              <>
                <Text style={commonStyles.meta}>
                  {job.model.provider}/{job.model.modelId} · {job.cloudExecution.region}
                </Text>
                <Text style={commonStyles.meta}>
                  {formatTokens(job.tokenUsage.total)} total tokens · {job.piiReport.redactions} redactions
                </Text>
              </>
            ) : null}
          </Card>
          {job?.artifacts.length ? (
            <PrimaryButton label="Review output" onPress={() => setExpanded(job.artifacts[0].id)} />
          ) : null}
          {job?.artifacts.map((artifact) => (
            <Pressable
              key={artifact.id}
              onPress={() => setExpanded(expanded === artifact.id ? null : artifact.id)}>
              <Card tone="butter">
                <Text style={commonStyles.heading}>{artifact.kind.replaceAll('_', ' ')}</Text>
                <Text style={commonStyles.body}>
                  {expanded === artifact.id ? artifact.content || artifact.preview : artifact.preview}
                </Text>
                <Text style={commonStyles.meta}>{expanded === artifact.id ? 'Tap to collapse' : 'Tap to expand'}</Text>
              </Card>
            </Pressable>
          ))}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!decided ? (
            <View style={commonStyles.buttonRow}>
              <SecondaryButton
                label="Assign to person"
                disabled={busy}
                onPress={() => void triage(false)}
              />
              <PrimaryButton
                label="Send to AI"
                disabled={busy}
                onPress={() => void triage(true)}
              />
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </AsyncState>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  transition: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: colors.border, paddingTop: 10 },
  warningText: { color: colors.onBlush, fontWeight: '700' },
  error: { color: colors.danger, textAlign: 'center' },
});
