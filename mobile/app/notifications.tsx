import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NotificationItem } from '@shared/types';
import { api } from '@/src/api';
import {
  AsyncState,
  type CardTone,
  Card,
  colors,
  commonStyles,
  PageHeader,
  Tag,
  timeAgo,
  useAsync,
} from '@/src/ui';

function notificationTone(kind: NotificationItem['kind'], read: boolean): CardTone {
  if (read) return 'default';
  if (kind === 'pii_block') return 'blush';
  if (kind === 'approval') return 'butter';
  return 'mint';
}

function kindTagTone(kind: NotificationItem['kind']) {
  if (kind === 'pii_block') return 'blush' as const;
  if (kind === 'approval') return 'butter' as const;
  return 'mint' as const;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const query = useAsync(() => api.listNotifications());
  const sorted = [...(query.data ?? [])].sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const open = async (notification: NotificationItem) => {
    if (!notification.read) {
      try {
        await api.markNotificationRead(notification.id);
      } catch {
        // Navigation remains useful if marking read fails.
      }
    }
    if (notification.kind === 'approval') router.push('/(tabs)/approvals');
    else if (notification.workItemId) router.push(`/ticket/${notification.workItemId}`);
    else if (notification.kind === 'pii_block') router.push('/(tabs)/pii');
    else router.push('/(tabs)/jobs');
  };

  const markAll = async () => {
    await api.markAllNotificationsRead();
    query.retry();
  };

  return (
    <AsyncState loading={query.loading} error={query.error} onRetry={query.retry}>
      <ScrollView style={commonStyles.screen} contentContainerStyle={commonStyles.content}>
        <PageHeader title="Notifications" description="AI drafts, PII blocks, and approvals that need a look." />
        {sorted.some((item) => !item.read) ? (
          <Pressable testID="notifications-mark-all-button" onPress={() => void markAll()}>
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        ) : null}
        {sorted.length === 0 ? (
          <Card tone="mint">
            <Text style={commonStyles.heading}>No notifications</Text>
            <Text style={commonStyles.body}>AI drafts, PII blocks, and approvals will appear here.</Text>
          </Card>
        ) : null}
        {sorted.map((notification) => (
          <Pressable key={notification.id} onPress={() => void open(notification)}>
            <Card tone={notificationTone(notification.kind, notification.read)} style={notification.read ? styles.read : undefined}>
              <View style={styles.between}>
                <Text style={styles.title}>{notification.title}</Text>
                <Text style={commonStyles.meta}>{timeAgo(notification.createdAt)}</Text>
              </View>
              <Text style={commonStyles.body}>{notification.body}</Text>
              <Tag label={notification.kind.replaceAll('_', ' ')} tone={kindTagTone(notification.kind)} />
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </AsyncState>
  );
}

const styles = StyleSheet.create({
  markAll: { color: colors.primary, fontWeight: '700', textAlign: 'right' },
  read: { opacity: 0.72 },
  between: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
});
