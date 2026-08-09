import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AplifyLogo } from '@/src/AplifyLogo';
import { useSession } from '@/src/session';
import { colors, commonStyles, PrimaryButton } from '@/src/ui';

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Deep-link landing for aplifyai://auth/callback?exchange=…&provider=…
 * Also opened if the OS delivers the redirect outside openAuthSessionAsync.
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const { completeFederatedExchange, session } = useSession();
  const router = useRouter();
  const [asyncError, setAsyncError] = useState<string | null>(null);

  const exchange = first(params.exchange as string | string[] | undefined);
  const provider = first(params.provider as string | string[] | undefined);
  const syncError =
    first(params.sso_error as string | string[] | undefined) ||
    first(params.error as string | string[] | undefined) ||
    first(params.google_error as string | string[] | undefined) ||
    first(params.apple_error as string | string[] | undefined) ||
    first(params.okta_error as string | string[] | undefined) ||
    first(params.entra_error as string | string[] | undefined) ||
    first(params.google_workspace_error as string | string[] | undefined) ||
    (provider
      ? first(params[`${provider}_error`] as string | string[] | undefined)
      : undefined) ||
    (!exchange ? 'Missing exchange code. Try signing in again.' : null);
  const error = syncError || asyncError;

  useEffect(() => {
    if (session) {
      router.replace('/(tabs)/triage');
      return;
    }
    if (syncError || !exchange) return;

    let cancelled = false;
    void (async () => {
      try {
        await completeFederatedExchange(exchange);
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
      <View style={styles.screen} testID="sso-callback-error">
        <AplifyLogo size={56} />
        <Text style={commonStyles.heading}>Couldn’t finish sign-in</Text>
        <Text style={styles.error}>{error}</Text>
        <PrimaryButton label="Back to login" onPress={() => router.replace('/login')} />
      </View>
    );
  }

  return (
    <View style={styles.screen} testID="sso-callback-pending">
      <AplifyLogo size={56} withWordmark stacked />
      <ActivityIndicator color={colors.primary} style={styles.spinner} />
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
  spinner: { marginTop: 8 },
  error: { ...commonStyles.body, color: colors.danger, textAlign: 'center' },
});
