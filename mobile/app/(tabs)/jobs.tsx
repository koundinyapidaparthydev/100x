import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/src/api';
import {
  AsyncState,
  colors,
  commonStyles,
  formatTokens,
  useAsync,
} from '@/src/ui';

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
        <Text style={commonStyles.title}>AI Jobs</Text>
        <Text style={commonStyles.body}>Queued, running, ready, and blocked AI work across Jira projects.</Text>
        {query.data ? (
          <>
            <View style={[commonStyles.card, styles.stats]}>
              <View>
                <Text style={styles.stat}>{query.data.stats.activeJobs}</Text>
                <Text style={commonStyles.meta}>Active</Text>
              </View>
              <View>
                <Text style={styles.stat}>{query.data.stats.queuedJobs}</Text>
                <Text style={commonStyles.meta}>Queued</Text>
              </View>
              <View>
                <Text style={styles.stat}>{Math.round(query.data.stats.tokenBudgetUsedPercent)}%</Text>
                <Text style={commonStyles.meta}>Budget used</Text>
              </View>
            </View>
            {query.data.jobs.length === 0 ? (
              <View style={commonStyles.card}>
                <Text style={commonStyles.heading}>No AI jobs yet</Text>
                <Text style={commonStyles.body}>Swipe a ticket AI-first to enqueue work.</Text>
              </View>
            ) : (
              query.data.jobs.map((job) => (
                <Pressable
                  key={job.id}
                  onPress={() => router.push(`/ticket/${job.workItemId}`)}
                  style={commonStyles.card}>
                  <View style={styles.between}>
                    <Text style={styles.jobId}>{job.id}</Text>
                    <Text style={styles.state}>{job.state.replaceAll('_', ' ')}</Text>
                  </View>
                  <Text style={commonStyles.meta}>
                    Ticket {job.workItemId} · {formatTokens(job.tokenUsage.total)} tokens
                  </Text>
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
  between: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  jobId: { color: colors.text, fontWeight: '700', flex: 1 },
  state: { color: colors.primary, fontSize: 11, textTransform: 'uppercase', fontWeight: '700' },
});
