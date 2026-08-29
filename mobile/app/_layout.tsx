import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BrandLogo } from '@/src/BrandLogo';
import { hasSeenOnboarding } from '@/src/onboarding';
import { colors } from '@/src/ui';
import { SessionProvider, useSession } from '@/src/session';

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Native splash may be absent in some Detox/unsigned builds.
});

function BootLoading() {
  return (
    <View style={styles.boot} testID="boot-loading">
      <BrandLogo size={48} withWordmark stacked />
      <ActivityIndicator color={colors.primary} style={styles.bootSpinner} />
      <Text style={styles.bootMeta}>Loading your workspace…</Text>
    </View>
  );
}

function Navigation() {
  const { session, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    void (async () => {
      const root = String(segments[0] ?? '');
      const publicRoute = root === '' || root === 'login' || root === 'auth';
      if (!session) {
        if (!publicRoute && root !== 'onboarding') {
          router.replace('/login');
        }
        return;
      }
      // Allow revisiting How it works while signed in.
      if (root === 'onboarding') return;

      const seen = await hasSeenOnboarding();
      if (cancelled) return;

      if (root === '' || root === 'login' || root === 'auth') {
        router.replace(seen ? '/(tabs)/triage' : '/onboarding');
        return;
      }
      if (!seen && root === '(tabs)') {
        router.replace('/onboarding');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, router, segments, session]);

  if (loading) return <BootLoading />;

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontSize: 15, fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
          animationDuration: 220,
          gestureEnabled: true,
        }}>
        <Stack.Screen name="index" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false, title: 'Signing in', animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="ticket/[id]" options={{ title: 'Ticket' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider>
        <Navigation />
      </SessionProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
    gap: 10,
  },
  bootSpinner: { marginTop: 10 },
  bootMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
