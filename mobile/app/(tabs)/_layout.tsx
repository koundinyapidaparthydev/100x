import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '@/src/ui';

export default function TabsLayout() {
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
          shadowColor: 'transparent',
          elevation: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarItemStyle: { borderRadius: 14, marginHorizontal: 4 },
        tabBarActiveBackgroundColor: colors.primarySoft,
        headerRight: () => (
          <Pressable
            testID="notifications-button"
            accessibilityLabel="Notifications"
            onPress={() => router.push('/notifications')}
            style={styles.bell}>
            <View style={styles.bellShell}>
              <MaterialCommunityIcons name="bell-outline" size={22} color={colors.primary} />
            </View>
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

const styles = StyleSheet.create({
  bell: { paddingHorizontal: 12, paddingVertical: 8 },
  bellShell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
