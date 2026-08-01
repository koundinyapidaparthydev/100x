import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ApprovalItem } from '@shared/types';
import { api } from '@/src/api';
import {
  AsyncState,
  type CardTone,
  Card,
  colors,
  commonStyles,
  Field,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  Tag,
  timeAgo,
  useAsync,
} from '@/src/ui';

function approvalTone(item: ApprovalItem): CardTone {
  if (item.status !== 'pending') return 'default';
  if (item.risk === 'high') return 'blush';
  if (item.risk === 'medium') return 'butter';
  return 'mint';
}

export default function ApprovalsScreen() {
  const query = useAsync(() => api.listApprovals());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const decide = async (item: ApprovalItem, decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && !rejectionReason.trim()) {
      setError('Add a rejection reason before recording this decision.');
      return;
    }
    setBusyId(item.id);
    setError(null);
    try {
      await api.decideApproval(item.id, decision);
      setRejectingId(null);
      setRejectionReason('');
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
        <PageHeader
          title="Approvals"
          description="Review exception requests. Decisions are recorded but do not enact the requested exception."
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {query.data?.length === 0 ? (
          <Card tone="mint">
            <Text style={commonStyles.heading}>Nothing to approve</Text>
            <Text style={commonStyles.body}>Exception requests will appear here.</Text>
          </Card>
        ) : null}
        {query.data?.map((item) => (
          <Card key={item.id} tone={approvalTone(item)} style={item.status !== 'pending' ? styles.decided : undefined}>
            <View style={styles.between}>
              <Text style={styles.title}>{item.title}</Text>
              <StatusBadge
                status={item.risk}
                label={`${item.risk} risk`}
                tone={item.risk === 'high' ? 'danger' : item.risk === 'medium' ? 'warning' : 'neutral'}
              />
            </View>
            <Text style={commonStyles.body}>{item.reason}</Text>
            <View style={styles.metaRow}>
              <Tag label="Exception" tone="neutral" />
              <Text style={commonStyles.meta}>Requested {timeAgo(item.requestedAt)}</Text>
            </View>
            <View style={styles.details}>
              <Text style={commonStyles.meta}>Current value</Text>
              <Text style={commonStyles.body}>Not provided by API</Text>
              <Text style={commonStyles.meta}>Requester and scope</Text>
              <Text style={commonStyles.body}>Not provided by API</Text>
            </View>
            {item.status === 'pending' ? (
              <>
                {rejectingId === item.id ? (
                  <Field
                    label="Rejection reason"
                    value={rejectionReason}
                    onChangeText={setRejectionReason}
                    placeholder="Why should this request not proceed?"
                    hint="Required to confirm. The current API does not persist this note."
                  />
                ) : null}
                <View style={commonStyles.buttonRow}>
                  {rejectingId === item.id ? (
                    <>
                      <PrimaryButton
                        danger
                        testID={`approval-reject-${item.id}`}
                        label={busyId === item.id ? 'Recording…' : 'Record rejection'}
                        disabled={busyId !== null || !rejectionReason.trim()}
                        onPress={() => void decide(item, 'rejected')}
                      />
                      <SecondaryButton label="Cancel" disabled={busyId !== null} onPress={() => { setRejectingId(null); setRejectionReason(''); }} />
                    </>
                  ) : (
                    <>
                      <PrimaryButton
                        testID={`approval-approve-${item.id}`}
                        label={busyId === item.id ? 'Recording…' : 'Record approval'}
                        disabled={busyId !== null}
                        onPress={() => void decide(item, 'approved')}
                      />
                      <SecondaryButton testID={`approval-reject-${item.id}`} label="Reject…" disabled={busyId !== null} onPress={() => setRejectingId(item.id)} />
                    </>
                  )}
                </View>
              </>
            ) : (
              <StatusBadge status={item.status} label={`${item.status} · record only`} />
            )}
          </Card>
        ))}
      </ScrollView>
    </AsyncState>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700', flex: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  details: { backgroundColor: colors.surface, borderRadius: 14, padding: 12, gap: 5 },
  decided: { opacity: 0.7 },
  error: { color: colors.danger, textAlign: 'center' },
});
