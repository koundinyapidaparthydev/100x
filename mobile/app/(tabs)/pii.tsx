import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '@/src/api';
import {
  AsyncState,
  Card,
  colors,
  commonStyles,
  EmptyState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  Tag,
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
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const requestAccess = async () => {
    if (!query.data?.workItemId) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.requestPiiAccess(
        query.data.workItemId,
        `Manager requests PII policy review for ${query.data.issueKey ?? query.data.workItemId}`,
      );
      setMessage({ text: 'Review request created. It now appears under Approvals; this does not change the PII rule.' });
    } catch (reason) {
      setMessage({ text: reason instanceof Error ? reason.message : 'The review request could not be created.', error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AsyncState loading={query.loading} error={query.error} onRetry={query.retry}>
      <ScrollView
        style={commonStyles.screen}
        contentContainerStyle={commonStyles.content}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        keyboardShouldPersistTaps="handled"
      >
        <PageHeader
          eyebrow="Governance"
          title="Sensitive data"
          description="Work stopped by a configured PII rule. Rule editing is on web Governance — mobile only requests review or shows the block."
        />

        {!query.data?.workItemId ? (
          <EmptyState
            title="No blocked work"
            body="No work item is currently reported as blocked by a PII rule."
          />
        ) : (
          <>
            <Card testID="pii-block-card" tone="blush">
              <View style={styles.cardHeader}>
                <View style={styles.icon}>
                  <MaterialCommunityIcons name="shield-alert-outline" size={26} color={colors.onBlush} />
                </View>
                <StatusBadge status="blocked_pii" />
              </View>
              <Text style={commonStyles.heading}>{query.data.issueKey ?? 'Blocked work item'}</Text>
              <Text style={commonStyles.body}>
                The job stopped before its model call after the detector found a category configured to block.
              </Text>
              <View style={styles.categories}>
                {query.data.categories.length ? (
                  query.data.categories.map((category) => (
                    <Tag key={category} label={category.replaceAll('_', ' ')} tone="blush" />
                  ))
                ) : (
                  <Text style={commonStyles.body}>The API did not return category details.</Text>
                )}
              </View>
            </Card>

            <Card tone="butter">
              <Text style={commonStyles.heading}>Detection scope</Text>
              <Text style={commonStyles.body}>
                The current check uses supported patterns in the ticket title and description. It does not claim to inspect
                comments, attachments, or values outside those patterns.
              </Text>
            </Card>

            {message ? (
              <Card tone={message.error ? 'blush' : 'mint'}>
                <Text style={message.error ? styles.errorMessage : styles.message}>{message.text}</Text>
              </Card>
            ) : null}

            <View style={commonStyles.buttonRow}>
              <PrimaryButton
                grow
                testID="pii-request-access-button"
                label={busy ? 'Requesting…' : 'Request policy review'}
                disabled={busy}
                onPress={() => void requestAccess()}
              />
              <SecondaryButton
                grow
                testID="pii-open-ticket-button"
                label="Open ticket"
                onPress={() => router.push(`/ticket/${query.data!.workItemId}`)}
              />
            </View>
            <Text style={styles.note}>
              A review request creates an approval record. It does not reveal the matched value or change the saved PII
              rule — edit clearing rules on web Governance.
            </Text>
          </>
        )}
      </ScrollView>
    </AsyncState>
  );
}

const styles = StyleSheet.create({
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  message: { color: colors.onMint, textAlign: 'center' },
  errorMessage: { color: colors.onBlush, textAlign: 'center' },
  note: { color: colors.muted, fontSize: 12, lineHeight: 17, textAlign: 'center', paddingHorizontal: 8 },
});
