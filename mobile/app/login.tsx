import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/src/session';
import { Card, colors, commonStyles, PrimaryButton, StatusBadge, Tag } from '@/src/ui';

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
      <View style={styles.atmosphere} />
      <View style={styles.content}>
        <View style={styles.logo}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={36} color={colors.primary} />
        </View>
        <Text style={styles.brand}>AplifyAI</Text>
        <Text style={styles.description}>
          Open the manager demo to triage work and record approval decisions.
        </Text>
        <Card tone="mint" style={styles.role}>
          <View style={styles.roleHeader}>
            <Text style={commonStyles.heading}>Manager</Text>
            <View style={styles.roleTags}>
              <Tag label="Demo" tone="mint" />
              <StatusBadge status="pending" label="Demo role" />
            </View>
          </View>
          <Text style={commonStyles.body}>
            Can send work to AI, assign people, and record approval decisions.
          </Text>
        </Card>
        <View style={styles.actions}>
          <PrimaryButton
            testID="login-primary-button"
            label={busy ? 'Signing in…' : 'Continue as manager'}
            disabled={busy}
            onPress={() => void enter()}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </View>
      <Text style={styles.trust}>Demo authentication only. Production identity is not configured here.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: 20 },
  atmosphere: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.butterSoft,
    opacity: 0.28,
  },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(79,99,182,0.22)',
  },
  brand: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  description: { ...commonStyles.body, textAlign: 'center', maxWidth: 340 },
  role: { width: '100%', marginTop: 10 },
  roleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  roleTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { width: '100%', marginTop: 18, gap: 12 },
  error: { color: colors.danger, textAlign: 'center' },
  trust: { ...commonStyles.meta, textAlign: 'center', paddingBottom: 8 },
});
