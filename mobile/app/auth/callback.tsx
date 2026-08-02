import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/src/session';
import { colors, commonStyles, PrimaryButton } from '@/src/ui';

const exchangeInflight = new Map<string, Promise<void>>();

/**
 * Deep-link landing for aplifyai://auth/callback?exchange=…&provider=…
 * Also opened if the OS delivers the redirect outside openAuthSessionAsync.
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{
    exchange?: string;
    provider?: string;
    sso_error?: string;
    error?: string;
  }>();
  const { completeFederatedExchange, session } = useSession();
  const router = useRouter();
  const [asyncError, setAsyncError] = useState<string | null>(null);
  const exchange = Array.isArray(params.exchange) ? params.exchange[0] : params.exchange;
  const ssoError = Array.isArray(params.sso_error) ? params.sso_error[0] : params.sso_error;
  const paramError = Array.isArray(params.error) ? params.error[0] : params.error;
  const syncError = ssoError || paramError || (!exchange ? 'Missing exchange code. Try signing in again.' : null);
  const error = syncError || asyncError;

  useEffect(() => {
    if (session) {
      router.replace('/(tabs)/triage');
      return;
    }
    if (syncError || !exchange) return;

    let cancelled = false;
    let pending = exchangeInflight.get(exchange);
    if (!pending) {
      pending = completeFederatedExchange(exchange).catch((reason) => {
        exchangeInflight.delete(exchange);
        throw reason;
      });
      exchangeInflight.set(exchange, pending);
    }
    void (async () => {
      try {
        await pending;
        if (!cancelled) router.replace('/(tabs)/triage');
      } catch (reason) {
        if (!cancelled) {
          setAsyncError(reason instanceof Error ? reason.message : 'Sign-in failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [completeFederatedExchange, exchange, router, session, syncError]);

  if (error) {
    return (
      <View style={styles.screen}>
        <Text style={commonStyles.heading}>Couldn’t finish sign-in</Text>
        <Text style={styles.error}>{error}</Text>
        <PrimaryButton label="Back to login" onPress={() => router.replace('/login')} />
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="sso-callback-pending">
      <Text style={commonStyles.heading}>Completing sign-in…</Text>
      <Text style={commonStyles.meta}>Exchanging your secure session</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  error: { ...commonStyles.body, color: colors.danger, textAlign: 'center' },
});
