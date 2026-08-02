import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { FederatedAuthProvider, FederatedProviderStatus } from '@shared/types';
import { api } from '@/src/api';
import { useSession } from '@/src/session';
import { Card, colors, commonStyles, PrimaryButton, SecondaryButton, StatusBadge, Tag } from '@/src/ui';

const PROVIDER_ORDER: FederatedAuthProvider[] = [
  'google',
  'apple',
  'okta',
  'entra',
  'google_workspace',
];

const PROVIDER_LABEL: Record<FederatedAuthProvider, string> = {
  google: 'Continue with Google',
  apple: 'Continue with Apple',
  okta: 'Continue with Okta',
  entra: 'Continue with Microsoft',
  google_workspace: 'Continue with Google Workspace',
};

type DemoSeat = {
  id: 'manager' | 'founder' | 'engineer';
  title: string;
  description: string;
  fullAccess: boolean;
};

const DEMO_SEATS: DemoSeat[] = [
  {
    id: 'manager',
    title: 'Delivery lead',
    description: 'Triage work, assign people, and record approval decisions.',
    fullAccess: true,
  },
  {
    id: 'founder',
    title: 'Workspace owner',
    description: 'Full demo access across triage and approvals.',
    fullAccess: true,
  },
  {
    id: 'engineer',
    title: 'Contributor',
    description: 'Read-mostly seat to preview limited permissions.',
    fullAccess: false,
  },
];

export default function LoginScreen() {
  const { signIn, signInWithProvider } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<FederatedProviderStatus[]>([]);
  const [providersChecked, setProvidersChecked] = useState(false);
  const [seat, setSeat] = useState<DemoSeat['id']>('manager');
  const [showSeats, setShowSeats] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api
      .authProvidersStatus()
      .then((res) => {
        if (!cancelled) {
          setProviders(res.providers);
          setProvidersChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProviders([]);
          setProvidersChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byProvider = useMemo(() => {
    const map = new Map<FederatedAuthProvider, FederatedProviderStatus>();
    for (const p of providers) map.set(p.provider, p);
    return map;
  }, [providers]);

  const selected = DEMO_SEATS.find((item) => item.id === seat) ?? DEMO_SEATS[0]!;

  const enter = async (identity: DemoSeat['id'] = 'manager') => {
    setBusy(true);
    setError(null);
    try {
      await signIn(identity);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const enterProvider = async (provider: FederatedAuthProvider) => {
    setBusy(true);
    setError(null);
    try {
      await signInWithProvider(provider);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'SSO login failed';
      if (message !== 'Sign-in cancelled') setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.atmosphere} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logo}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={36} color={colors.primary} />
        </View>
        <Text style={styles.brand}>AplifyAI</Text>
        <Text style={styles.description}>
          Building-stage demo — continue with full access, pick a seat, or use SSO when configured.
        </Text>
        <Card tone="mint" style={styles.role}>
          <View style={styles.roleHeader}>
            <Text style={commonStyles.heading}>{selected.title}</Text>
            <View style={styles.roleTags}>
              <Tag label="Demo" tone="mint" />
              <StatusBadge status="pending" label={selected.fullAccess ? 'Full access' : 'Limited'} />
            </View>
          </View>
          <Text style={commonStyles.body}>{selected.description}</Text>
        </Card>
        <View style={styles.actions}>
          <PrimaryButton
            testID="login-primary-button"
            label={busy ? 'Signing in…' : 'Continue as demo'}
            disabled={busy}
            onPress={() => void enter('manager')}
          />
          <Pressable
            accessibilityRole="button"
            testID="login-toggle-seats"
            onPress={() => setShowSeats((open) => !open)}
            style={styles.seatToggle}
          >
            <Text style={styles.seatToggleLabel}>
              {showSeats ? 'Hide seat options' : 'Or choose a specific seat'}
            </Text>
          </Pressable>
          {showSeats ? (
            <View style={styles.seatList}>
              {DEMO_SEATS.map((item) => {
                const active = item.id === seat;
                return (
                  <Pressable
                    key={item.id}
                    testID={`login-seat-${item.id}`}
                    onPress={() => setSeat(item.id)}
                    style={[styles.seatOption, active && styles.seatOptionActive]}
                  >
                    <Text style={styles.seatTitle}>{item.title}</Text>
                    <Text style={styles.seatBody}>{item.description}</Text>
                  </Pressable>
                );
              })}
              <PrimaryButton
                testID="login-seat-continue"
                label={busy ? 'Signing in…' : `Continue as ${selected.title.toLowerCase()}`}
                disabled={busy}
                onPress={() => void enter(seat)}
              />
            </View>
          ) : null}
          <Text style={styles.divider}>Or continue with</Text>
          {PROVIDER_ORDER.map((provider) => {
            const enabled = byProvider.get(provider)?.enabled === true;
            const label =
              providersChecked && !enabled
                ? `${PROVIDER_LABEL[provider]} — not configured`
                : PROVIDER_LABEL[provider];
            return (
              <SecondaryButton
                key={provider}
                testID={`login-${provider}`}
                label={label}
                disabled={busy || (providersChecked && !enabled)}
                onPress={() => void enterProvider(provider)}
              />
            );
          })}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </ScrollView>
      <Text style={styles.trust}>
        Demo authentication works offline of SSO. Configure IdP env vars on the backend to enable
        Google, Apple, Okta, Entra, and Google Workspace.
      </Text>
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
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 16 },
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
  actions: { width: '100%', marginTop: 18, gap: 10 },
  seatToggle: { alignItems: 'center', paddingVertical: 4 },
  seatToggleLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  seatList: { gap: 8 },
  seatOption: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  seatOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  seatTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  seatBody: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  divider: { ...commonStyles.meta, textAlign: 'center', marginTop: 4 },
  error: { color: colors.danger, textAlign: 'center' },
  trust: { ...commonStyles.meta, textAlign: 'center', paddingBottom: 8 },
});
