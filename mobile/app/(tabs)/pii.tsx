import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '@/src/api';
import {
  AsyncState,
  colors,
  commonStyles,
  PrimaryButton,
  SecondaryButton,
  useAsync,
} from '@/src/ui';

export default function PiiScreen() {
  const params = useLocalSearchParams<{ workItemId?: string; issueKey?: string; categories?: string }>();
  const router = useRouter();
  const query = useAsync(async () => {
    if (params.workItemId) {
      return {
        workItemId: params.workItemId,
        issueKey: params.issueKey,
        categories: params.categories?.split(',').filter(Boolean) ?? [],
      };
    }
    const item = (await api.listWorkItems({ aiStatus: 'blocked_pii' }))[0];
    if (!item) return { workItemId: undefined, issueKey: undefined, categories: [] };
    const job = item.lastAiJobId ? await api.getJob(item.lastAiJobId) : null;
    return { workItemId: item.id, issueKey: item.board.issueKey, categories: job?.piiReport.blocks ?? [] };
  }, [params.workItemId, params.issueKey, params.categories]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const requestAccess = async () => {
    if (!query.data?.workItemId) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.requestPiiAccess(
        query.data.workItemId,
        `Manager requests temporary PII policy review for ${query.data.issueKey ?? query.data.workItemId}`,
      );
      setMessage('Access request sent. It now appears under Approvals.');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AsyncState loading={query.loading} error={query.error} onRetry={query.retry}>
      <View style={styles.screen}>
        <View style={styles.icon}>
          <MaterialCommunityIcons name="shield-alert-outline" size={44} color={colors.warning} />
        </View>
        <Text style={styles.title}>Blocked by the PII firewall</Text>
        <Text style={styles.body}>
          {query.data?.issueKey
            ? `Ticket ${query.data.issueKey} stopped before any model call because its payload matched blocked policy categories.`
            : 'No tickets are currently PII-blocked.'}
        </Text>
        <View style={styles.categories}>
          {query.data?.categories.map((category) => (
            <Text key={category} style={styles.category}>{category}</Text>
          ))}
        </View>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <PrimaryButton
          testID="pii-request-access-button"
          label={busy ? 'Requesting…' : 'Ask for access'}
          disabled={busy || !query.data?.workItemId}
          onPress={() => void requestAccess()}
        />
        {query.data?.workItemId ? (
          <SecondaryButton
            testID="pii-open-ticket-button"
            label="Open ticket"
            onPress={() => router.push(`/ticket/${query.data!.workItemId}`)}
          />
        ) : null}
      </View>
    </AsyncState>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 14 },
  icon: { width: 80, height: 80, borderRadius: 20, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' },
  title: { ...commonStyles.title, textAlign: 'center', fontSize: 24 },
  body: { ...commonStyles.body, textAlign: 'center' },
  categories: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  category: { color: colors.warning, backgroundColor: colors.warningSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, textTransform: 'uppercase', fontSize: 11, fontWeight: '700' },
  message: { color: colors.primary, textAlign: 'center' },
});
