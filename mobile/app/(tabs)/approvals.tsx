import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  // Keep list visible after decide while refetch runs (status overlay until server catches up).
  const [localStatus, setLocalStatus] = useState<Record<string, ApprovalItem['status']>>({});

  const items = useMemo(() => {
    const list = query.data ?? [];
    if (!Object.keys(localStatus).length) return list;
    return list.map((item) => {
      const status = localStatus[item.id];
      return status && status !== item.status ? { ...item, status } : item;
    });
  }, [localStatus, query.data]);

  const decide = async (item: ApprovalItem, decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && !rejectionReason.trim()) {
      setError('Add a rejection reason before recording this decision.');
      return;
    }
    setBusyId(item.id);
    setError(null);
    setLocalStatus((prev) => ({ ...prev, [item.id]: decision }));
    try {
      await api.decideApproval(item.id, decision);
      setRejectingId(null);
      setRejectionReason('');
      query.retry();
    } catch (reason) {
      setLocalStatus((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setError(reason instanceof Error ? reason.message : 'Decision failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AsyncState loading={query.loading && !query.data} error={query.error} onRetry={query.retry}>
      <ScrollView
        testID="approvals-screen"
        style={commonStyles.screen}
        contentContainerStyle={commonStyles.content}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={query.loading} onRefresh={query.retry} />}
      >
        <PageHeader
          title="Approvals"
          description="Exception requests — decisions are recorded, not auto-enacted."
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {items.length === 0 ? (
          <Card tone="mint">
            <Text style={commonStyles.heading}>Nothing to approve</Text>
            <Text style={commonStyles.body}>Exception requests will appear here.</Text>
          </Card>
        ) : null}
        {items.map((item) => (
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
              <Text style={commonStyles.meta}>Work item</Text>
              <Text style={commonStyles.body}>{item.workItemId}</Text>
              <Text style={commonStyles.meta}>Decision</Text>
              <Text style={commonStyles.body}>
                Recorded for audit — does not auto-change the underlying rule.
              </Text>
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
                        grow
                        danger
                        testID={`approval-reject-${item.id}`}
                        label={busyId === item.id ? 'Recording…' : 'Record rejection'}
                        disabled={busyId !== null || !rejectionReason.trim()}
                        onPress={() => void decide(item, 'rejected')}
                      />
                      <SecondaryButton
                        grow
                        label="Cancel"
                        disabled={busyId !== null}
                        onPress={() => {
                          setRejectingId(null);
                          setRejectionReason('');
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <PrimaryButton
                        grow
                        testID={`approval-approve-${item.id}`}
                        label={busyId === item.id ? 'Recording…' : 'Record approval'}
                        disabled={busyId !== null}
                        onPress={() => void decide(item, 'approved')}
                      />
                      <SecondaryButton
                        grow
                        testID={`approval-reject-${item.id}`}
                        label="Reject…"
                        disabled={busyId !== null}
                        onPress={() => setRejectingId(item.id)}
                      />
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
  title: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  details: { backgroundColor: colors.surface, borderRadius: 10, padding: 10, gap: 4 },
  decided: { opacity: 0.7 },
  error: { color: colors.danger, textAlign: 'center', fontSize: 12 },
});
