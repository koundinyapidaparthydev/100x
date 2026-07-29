import { useCallback, useEffect, useState } from 'react';
import type { DependencyList, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export const colors = {
  background: '#F4F6F8',
  surface: '#FFFFFF',
  surfaceMuted: '#E9EEF3',
  primary: '#3157D5',
  primarySoft: '#DFE6FF',
  text: '#17202A',
  muted: '#66717E',
  border: '#D6DDE5',
  danger: '#BA1A1A',
  dangerSoft: '#FFDAD6',
  warning: '#8A4D00',
  warningSoft: '#FFE2B8',
  success: '#146C43',
} as const;

export const commonStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  heading: { color: colors.text, fontSize: 18, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  meta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonRow: { flexDirection: 'row', gap: 10 },
});

export function PrimaryButton({
  label,
  onPress,
  disabled,
  testID,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: danger ? colors.danger : colors.primary },
        (pressed || disabled) && styles.dimmed,
      ]}>
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, (pressed || disabled) && styles.dimmed]}>
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function AsyncState({
  loading,
  error,
  empty,
  onRetry,
  children,
}: {
  loading: boolean;
  error: Error | null;
  empty?: boolean;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={commonStyles.body}>Loading…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error.message}</Text>
        <SecondaryButton label="Try again" onPress={onRetry} />
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.center}>
        <Text style={commonStyles.heading}>All clear</Text>
        <Text style={commonStyles.body}>There is nothing waiting for a decision.</Text>
      </View>
    );
  }
  return children;
}

export function useAsync<T>(load: () => Promise<T>, deps: DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [epoch, setEpoch] = useState(0);
  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setEpoch((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    void load()
      .then((value) => active && setData(value))
      .catch((reason: unknown) => active && setError(reason instanceof Error ? reason : new Error('Request failed')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // The caller controls reload dependencies; epoch powers manual retries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, epoch]);
  return { data, error, loading, retry };
}

export function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatTokens(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  buttonLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondary: {
    minHeight: 48,
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  dimmed: { opacity: 0.55 },
  center: { flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  error: { color: colors.danger, textAlign: 'center' },
});
