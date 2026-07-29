import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ApprovalItem } from '@shared/types';
import { api } from '@/src/api';
import {
  AsyncState,
  colors,
  commonStyles,
  PrimaryButton,
  SecondaryButton,
  timeAgo,
  useAsync,
} from '@/src/ui';

export default function ApprovalsScreen() {
  const query = useAsync(() => api.listApprovals());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (item: ApprovalItem, decision: 'approved' | 'rejected') => {
    setBusyId(item.id);
    setError(null);
    try {
      await api.decideApproval(item.id, decision);
      query.retry();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Decision failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AsyncState loading={query.loading} error={query.error} onRetry={query.retry}>
      <ScrollView style={commonStyles.screen} contentContainerStyle={commonStyles.content}>
        <Text style={commonStyles.title}>Approvals</Text>
        <Text style={commonStyles.body}>
          High-risk AI actions and mutating tool calls waiting on a manager decision.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {query.data?.length === 0 ? (
          <View style={commonStyles.card}>
            <Text style={commonStyles.heading}>Nothing to approve</Text>
            <Text style={commonStyles.body}>Manager sign-offs will appear here.</Text>
          </View>
        ) : null}
        {query.data?.map((item) => (
          <View key={item.id} style={[commonStyles.card, item.status !== 'pending' && styles.decided]}>
            <View style={styles.between}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={[styles.risk, item.risk === 'high' && styles.high]}>{item.risk} risk</Text>
            </View>
            <Text style={commonStyles.body}>{item.reason}</Text>
            <Text style={commonStyles.meta}>Requested {timeAgo(item.requestedAt)}</Text>
            {item.status === 'pending' ? (
              <View style={commonStyles.buttonRow}>
                <PrimaryButton
                  testID={`approval-approve-${item.id}`}
                  label={busyId === item.id ? 'Sending…' : 'Approve'}
                  disabled={busyId !== null}
                  onPress={() => void decide(item, 'approved')}
                />
                <SecondaryButton
                  testID={`approval-reject-${item.id}`}
                  label="Reject"
                  disabled={busyId !== null}
                  onPress={() => void decide(item, 'rejected')}
                />
              </View>
            ) : (
              <Text style={styles.status}>{item.status}</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </AsyncState>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700', flex: 1 },
  risk: { color: colors.warning, fontSize: 11, textTransform: 'uppercase', fontWeight: '800' },
  high: { color: colors.danger },
  status: { color: colors.success, fontWeight: '800', textTransform: 'uppercase' },
  decided: { opacity: 0.6 },
  error: { color: colors.danger, textAlign: 'center' },
});
