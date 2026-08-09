import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { colors } from '@/src/ui';

const MARK = require('../../assets/brand/aai-mark.png');

export default function TabsLayout() {
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
          shadowColor: 'transparent',
          elevation: 0,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600', fontSize: 15 },
        headerLeft: () => (
          <View style={styles.brandMark} accessibilityLabel="AplifyAI">
            <Image source={MARK} style={styles.brandImage} resizeMode="contain" />
          </View>
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 9, fontWeight: '600', marginBottom: 0 },
        tabBarIconStyle: { marginTop: 0 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingTop: 2,
          paddingBottom: 2,
          minHeight: 48,
        },
        tabBarItemStyle: { borderRadius: 8, marginHorizontal: 1, paddingVertical: 1 },
        tabBarActiveBackgroundColor: colors.primarySoft,
        animation: 'shift',
        headerRight: () => (
          <Pressable
            testID="notifications-button"
            accessibilityLabel="Notifications"
            onPress={() => router.push('/notifications')}
            style={styles.bell}>
            <View style={styles.bellShell}>
              <MaterialCommunityIcons name="bell-outline" size={18} color={colors.primary} />
            </View>
          </Pressable>
        ),
      }}>
      <Tabs.Screen
        name="triage"
        options={{
          title: 'Triage',
          tabBarButtonTestID: 'tab-triage',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="cards-outline" color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'AI Jobs',
          tabBarButtonTestID: 'tab-jobs',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="progress-clock" color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: 'Approvals',
          tabBarButtonTestID: 'tab-approvals',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="check-decagram-outline" color={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="pii"
        options={{
          title: 'PII',
          tabBarButtonTestID: 'tab-pii',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="shield-alert-outline" color={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarButtonTestID: 'tab-account',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="account-circle-outline" color={color} size={20} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  brandMark: { paddingLeft: 12, paddingVertical: 4 },
  brandImage: { width: 22, height: 22, borderRadius: 5 },
  bell: { paddingHorizontal: 10, paddingVertical: 6 },
  bellShell: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
