import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NotificationItem } from '@shared/types';
import { api } from '@/src/api';
import { AsyncState, colors, commonStyles, timeAgo, useAsync } from '@/src/ui';

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
        {sorted.some((item) => !item.read) ? (
          <Pressable testID="notifications-mark-all-button" onPress={() => void markAll()}>
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        ) : null}
        {sorted.length === 0 ? (
          <View style={commonStyles.card}>
            <Text style={commonStyles.heading}>No notifications</Text>
            <Text style={commonStyles.body}>AI drafts, PII blocks, and approvals will appear here.</Text>
          </View>
        ) : null}
        {sorted.map((notification) => (
          <Pressable
            key={notification.id}
            onPress={() => void open(notification)}
            style={[commonStyles.card, notification.read && styles.read]}>
            <View style={styles.between}>
              <Text style={styles.title}>{notification.title}</Text>
              <Text style={commonStyles.meta}>{timeAgo(notification.createdAt)}</Text>
            </View>
            <Text style={commonStyles.body}>{notification.body}</Text>
            <Text style={commonStyles.meta}>{notification.kind.replaceAll('_', ' ')}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </AsyncState>
  );
}

const styles = StyleSheet.create({
  markAll: { color: colors.primary, fontWeight: '700', textAlign: 'right' },
  read: { opacity: 0.6 },
  between: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
});
