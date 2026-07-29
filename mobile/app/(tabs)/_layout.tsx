import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { colors } from '@/src/ui';

export default function TabsLayout() {
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerRight: () => (
          <Pressable
            testID="notifications-button"
            accessibilityLabel="Notifications"
            onPress={() => router.push('/notifications')}
            style={{ padding: 14 }}>
            <MaterialCommunityIcons name="bell-outline" size={23} color={colors.primary} />
          </Pressable>
        ),
      }}>
      <Tabs.Screen
        name="triage"
        options={{
          title: 'Triage',
          tabBarButtonTestID: 'tab-triage',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cards-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'AI Jobs',
          tabBarButtonTestID: 'tab-jobs',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="progress-clock" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: 'Approvals',
          tabBarButtonTestID: 'tab-approvals',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="check-decagram-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="pii"
        options={{
          title: 'PII Firewall',
          tabBarButtonTestID: 'tab-pii',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="shield-alert-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
