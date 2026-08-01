import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AiJob } from '@shared/types';
import { api } from '@/src/api';
import {
  AsyncState,
  type CardTone,
  Card,
  colors,
  commonStyles,
  EmptyState,
  formatTokens,
  PageHeader,
  StatusBadge,
  Tag,
  timeAgo,
  useAsync,
} from '@/src/ui';

function jobCardTone(status: AiJob['state']): CardTone {
  if (status === 'blocked_pii' || status === 'failed') return 'blush';
  if (status === 'ready_for_human') return 'butter';
  if (
    status === 'running' ||
    status === 'queued' ||
    status === 'sanitizing' ||
    status === 'enriching_mcp' ||
    status === 'packaging' ||
    status === 'attaching'
  ) {
    return 'mint';
  }
  return 'default';
}

export default function JobsScreen() {
  const router = useRouter();
  const query = useAsync(async () => {
    const [jobs, stats] = await Promise.all([api.listJobs(), api.stats()]);
    return { jobs, stats };
  });
  return (
    <AsyncState loading={query.loading} error={query.error} onRetry={query.retry}>
      <ScrollView
        style={commonStyles.screen}
        contentContainerStyle={commonStyles.content}
        refreshControl={<RefreshControl refreshing={query.loading} onRefresh={query.retry} />}>
        <PageHeader title="Jobs" description="AI work that is queued, blocked, or ready for review." />
        {query.data ? (
          <>
            <Card tone="mint" style={styles.stats}>
              <View>
                <Text style={styles.stat}>{query.data.stats.readyForHuman}</Text>
                <Text style={commonStyles.meta}>Needs review</Text>
              </View>
              <View>
                <Text style={styles.stat}>{query.data.stats.queuedJobs}</Text>
                <Text style={commonStyles.meta}>Queued</Text>
              </View>
              <View>
                <Text style={[styles.stat, styles.blocked]}>{query.data.stats.piiBlocks24h}</Text>
                <Text style={commonStyles.meta}>Blocked today</Text>
              </View>
            </Card>
            {query.data.jobs.length === 0 ? (
              <EmptyState title="No AI jobs yet" body="Send a ticket to AI from Triage to create a job." />
            ) : (
              query.data.jobs.map((job) => (
                <Pressable key={job.id} onPress={() => router.push(`/ticket/${job.workItemId}`)}>
                  <Card tone={jobCardTone(job.state)}>
                    <View style={styles.between}>
                      <Text style={styles.jobId}>{job.workItemId}</Text>
                      <StatusBadge status={job.state} />
                    </View>
                    <View style={styles.metaRow}>
                      <Tag label={job.model.modelId} tone="neutral" />
                      <Text style={commonStyles.meta}>
                        {timeAgo(job.createdAt)} · {formatTokens(job.tokenUsage.total)} tokens
                      </Text>
                    </View>
                  </Card>
                </Pressable>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </AsyncState>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { color: colors.primary, fontSize: 24, fontWeight: '800' },
  blocked: { color: colors.danger },
  between: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  jobId: { color: colors.text, fontWeight: '700', flex: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
});
