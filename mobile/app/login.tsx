import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/src/session';
import { colors, commonStyles, PrimaryButton, SecondaryButton } from '@/src/ui';

export default function LoginScreen() {
  const { signIn } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enter = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.logo}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={42} color={colors.primary} />
        </View>
        <Text style={commonStyles.title}>AplifyAI</Text>
        <Text style={styles.description}>
          Triage your Jira queue in seconds under your organization&apos;s policy and token budgets.
        </Text>
        <View style={styles.actions}>
          <PrimaryButton
            testID="login-primary-button"
            label={busy ? 'Signing in…' : 'Continue as manager'}
            disabled={busy}
            onPress={() => void enter()}
          />
          <SecondaryButton
            testID="login-biometric-button"
            label="Biometric (demo)"
            disabled={busy}
            onPress={() => void enter()}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </View>
      <Text style={styles.trust}>Secure session · Bearer token · Stored in SecureStore</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: 20 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  description: { ...commonStyles.body, textAlign: 'center', maxWidth: 340 },
  actions: { width: '100%', marginTop: 18, gap: 12 },
  error: { color: colors.danger, textAlign: 'center' },
  trust: { ...commonStyles.meta, textAlign: 'center', paddingBottom: 8 },
});
