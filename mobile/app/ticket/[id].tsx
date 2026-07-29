import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '@/src/api';
import {
  AsyncState,
  colors,
  commonStyles,
  formatTokens,
  PrimaryButton,
  SecondaryButton,
  timeAgo,
  useAsync,
} from '@/src/ui';

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const query = useAsync(async () => {
    const workItem = await api.getWorkItem(id);
    const job = workItem.lastAiJobId ? await api.getJob(workItem.lastAiJobId) : null;
    return { workItem, job };
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
              style={styles.warning}
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
              <Text style={styles.warningText}>Blocked before model execution. Review the PII firewall.</Text>
            </Pressable>
          ) : null}
          <Text style={styles.issue}>{item.board.issueKey} · {item.priority}</Text>
          <Text style={commonStyles.title}>{item.title}</Text>
          <Text style={commonStyles.meta}>{item.status} · Updated {timeAgo(item.updatedAt)}</Text>
          <View style={commonStyles.card}>
            <Text style={commonStyles.heading}>Decision</Text>
            <Text style={commonStyles.body}>
              {item.aiFirst ? `${item.targetCompletionPercent}% AI-first` : 'Human-first'} · Assignee{' '}
              {item.assigneeExternalId ?? 'unassigned'}
            </Text>
          </View>
          <View style={commonStyles.card}>
            <Text style={commonStyles.heading}>Assign after AI</Text>
            <TextInput
              value={assignee}
              onChangeText={setAssignee}
              placeholder="Engineer ID"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={styles.input}
            />
            <SecondaryButton
              label={busy ? 'Saving…' : 'Save assignee'}
              disabled={busy}
              onPress={() => void updateAssignee()}
            />
          </View>
          <View style={commonStyles.card}>
            <Text style={commonStyles.heading}>Description</Text>
            <Text style={commonStyles.body}>
              {item.aiStatus === 'blocked_pii'
                ? 'Description hidden on device while this ticket is PII-blocked.'
                : item.description}
            </Text>
          </View>
          <View style={commonStyles.card}>
            <Text style={commonStyles.heading}>AI lifecycle</Text>
            <Text style={commonStyles.body}>
              {job ? job.state.replaceAll('_', ' ') : 'No AI job has started.'}
            </Text>
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
          </View>
          {job?.artifacts.map((artifact) => (
            <Pressable
              key={artifact.id}
              onPress={() => setExpanded(expanded === artifact.id ? null : artifact.id)}
              style={commonStyles.card}>
              <Text style={commonStyles.heading}>{artifact.kind.replaceAll('_', ' ')}</Text>
              <Text style={commonStyles.body}>
                {expanded === artifact.id ? artifact.content || artifact.preview : artifact.preview}
              </Text>
              <Text style={commonStyles.meta}>{expanded === artifact.id ? 'Tap to collapse' : 'Tap to expand'}</Text>
            </Pressable>
          ))}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!decided ? (
            <View style={commonStyles.buttonRow}>
              <SecondaryButton
                label="Human-first"
                disabled={busy}
                onPress={() => void triage(false)}
              />
              <PrimaryButton
                label="Approve AI hand-off"
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
  issue: { color: colors.primary, fontWeight: '800', textTransform: 'uppercase' },
  warning: { backgroundColor: colors.warningSoft, borderRadius: 14, padding: 14 },
  warningText: { color: colors.warning, fontWeight: '700' },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, color: colors.text },
  error: { color: colors.danger, textAlign: 'center' },
});
