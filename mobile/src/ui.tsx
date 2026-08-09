import { useCallback, useEffect, useState } from 'react';
import type { DependencyList, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native';

/**
 * Mirrors shared/theme.css pastel token contract.
 * Keep hex values in sync with --color-* / attention pastels there.
 */
export const colors = {
  background: '#F6F3EC',
  surface: '#FFFEF9',
  surfaceMuted: '#F3EFE7',
  surfaceHigh: '#EBE6DC',
  primary: '#4F63B6',
  primaryPressed: '#40539F',
  primarySoft: '#E5E8F7',
  text: '#262522',
  muted: '#6D6961',
  border: '#DED9CF',
  danger: '#B3443F',
  dangerSoft: '#F7E3DF',
  warning: '#94651E',
  warningSoft: '#F7EAD1',
  success: '#3F7653',
  successSoft: '#E1EEE4',
  mint: '#3F7A62',
  mintSoft: '#D8EFE4',
  onMint: '#1F4A38',
  butter: '#9A7420',
  butterSoft: '#F5ECC4',
  onButter: '#5C4510',
  blush: '#B05A5A',
  blushSoft: '#F5DED9',
  onBlush: '#6B2E2E',
} as const;

export type CardTone = 'default' | 'mint' | 'butter' | 'blush';
export type ChipTone = 'neutral' | 'primary' | 'mint' | 'butter' | 'blush' | 'success' | 'warning' | 'danger';
export type TagTone = ChipTone;

const CARD_TONE_STYLES: Record<Exclude<CardTone, 'default'>, ViewStyle> = {
  mint: { backgroundColor: colors.mintSoft, borderColor: 'rgba(63,122,98,0.22)' },
  butter: { backgroundColor: colors.butterSoft, borderColor: 'rgba(154,116,32,0.22)' },
  blush: { backgroundColor: colors.blushSoft, borderColor: 'rgba(176,90,90,0.22)' },
};

const CHIP_TONE_STYLES: Record<ChipTone, { backgroundColor: string; color: string; borderColor: string }> = {
  neutral: { backgroundColor: colors.surfaceMuted, color: colors.muted, borderColor: colors.border },
  primary: { backgroundColor: colors.primarySoft, color: colors.primary, borderColor: 'rgba(79,99,182,0.25)' },
  mint: { backgroundColor: colors.mintSoft, color: colors.onMint, borderColor: 'rgba(63,122,98,0.25)' },
  butter: { backgroundColor: colors.butterSoft, color: colors.onButter, borderColor: 'rgba(154,116,32,0.25)' },
  blush: { backgroundColor: colors.blushSoft, color: colors.onBlush, borderColor: 'rgba(176,90,90,0.25)' },
  success: { backgroundColor: colors.successSoft, color: colors.success, borderColor: 'rgba(63,118,83,0.25)' },
  warning: { backgroundColor: colors.warningSoft, color: colors.warning, borderColor: 'rgba(148,101,30,0.25)' },
  danger: { backgroundColor: colors.dangerSoft, color: colors.danger, borderColor: 'rgba(179,68,63,0.25)' },
};

const CHIP_SELECTED_STYLES: Record<ChipTone, { backgroundColor: string; color: string; borderColor: string }> = {
  neutral: { backgroundColor: colors.surfaceHigh, color: colors.text, borderColor: colors.text },
  primary: { backgroundColor: colors.primary, color: '#FFFFFF', borderColor: colors.primary },
  mint: { backgroundColor: colors.mint, color: '#FFFFFF', borderColor: colors.mint },
  butter: { backgroundColor: colors.butter, color: '#FFFFFF', borderColor: colors.butter },
  blush: { backgroundColor: colors.blush, color: '#FFFFFF', borderColor: colors.blush },
  success: { backgroundColor: colors.success, color: '#FFFFFF', borderColor: colors.success },
  warning: { backgroundColor: colors.warning, color: '#FFFFFF', borderColor: colors.warning },
  danger: { backgroundColor: colors.danger, color: '#FFFFFF', borderColor: colors.danger },
};

export const commonStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 14, paddingBottom: 28, gap: 10 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    shadowColor: '#262522',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  heading: { color: colors.text, fontSize: 14, fontWeight: '600' },
  body: { color: colors.muted, fontSize: 13, lineHeight: 17 },
  meta: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  /** Apply to PrimaryButton / SecondaryButton children of `buttonRow` for equal stretch. */
  buttonGrow: { flex: 1 },
});
export function Card({
  children,
  style,
  testID,
  tone = 'default',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  tone?: CardTone;
}) {
  return (
    <View
      testID={testID}
      style={[commonStyles.card, tone !== 'default' ? CARD_TONE_STYLES[tone] : null, style]}
    >
      {children}
    </View>
  );
}

export function Chip({
  label,
  tone = 'neutral',
  selected = false,
  count,
  onPress,
  testID,
  style,
}: {
  label: string;
  tone?: ChipTone;
  selected?: boolean;
  count?: number;
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = selected ? CHIP_SELECTED_STYLES[tone] : CHIP_TONE_STYLES[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
          opacity: pressed && onPress ? 0.88 : 1,
        },
        style,
      ]}
    >
      <Text style={[styles.chipLabel, { color: palette.color }]}>{label}</Text>
      {typeof count === 'number' ? (
        <View
          style={[
            styles.chipCount,
            { backgroundColor: selected ? 'rgba(255,255,255,0.22)' : colors.surface },
          ]}
        >
          <Text style={[styles.chipCountLabel, { color: palette.color }]}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Tag({
  label,
  tone = 'neutral',
  style,
  textStyle,
}: {
  label: string;
  tone?: TagTone;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const palette = CHIP_TONE_STYLES[tone];
  return (
    <View style={[styles.tag, { backgroundColor: palette.backgroundColor }, style]}>
      <Text style={[styles.tagLabel, { color: palette.color }, textStyle]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  style,
  testID,
  ...props
}: TextInputProps & { testID?: string }) {
  return (
    <View style={[styles.searchShell, style as StyleProp<ViewStyle>]}>
      <TextInput
        {...props}
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        accessibilityLabel={props.accessibilityLabel ?? placeholder}
        style={styles.searchInput}
      />
    </View>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.pageHeaderCopy}>
        {eyebrow ? <Text style={commonStyles.meta}>{eyebrow}</Text> : null}
        <Text style={commonStyles.title}>{title}</Text>
        {description ? <Text style={commonStyles.body}>{description}</Text> : null}
      </View>
      {action}
    </View>
  );
}

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const statusRegistry: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: 'Pending', tone: 'neutral' },
  queued: { label: 'Queued', tone: 'neutral' },
  sanitizing: { label: 'Sanitizing', tone: 'info' },
  enriching_mcp: { label: 'Enriching context', tone: 'info' },
  running: { label: 'In progress', tone: 'info' },
  packaging: { label: 'Packaging', tone: 'info' },
  attaching: { label: 'Attaching', tone: 'info' },
  ready_for_human: { label: 'Ready for review', tone: 'warning' },
  completed: { label: 'Ready for review', tone: 'success' },
  completed_pending_review: { label: 'Needs review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'danger' },
  blocked_pii: { label: 'Sensitive data blocked', tone: 'danger' },
  ai: { label: 'Sent to AI', tone: 'info' },
  human: { label: 'Assigned to person', tone: 'neutral' },
  redact: { label: 'Redacted', tone: 'success' },
  hash: { label: 'Hashed', tone: 'info' },
  allow: { label: 'Allowed', tone: 'warning' },
};

const badgeColors: Record<StatusTone, { backgroundColor: string; color: string }> = {
  neutral: { backgroundColor: colors.surfaceMuted, color: colors.muted },
  info: { backgroundColor: colors.mintSoft, color: colors.onMint },
  success: { backgroundColor: colors.successSoft, color: colors.success },
  warning: { backgroundColor: colors.butterSoft, color: colors.onButter },
  danger: { backgroundColor: colors.blushSoft, color: colors.onBlush },
};

export function StatusBadge({
  status,
  label,
  tone,
}: {
  status: string;
  label?: string;
  tone?: StatusTone;
}) {
  const definition = statusRegistry[status] ?? {
    label: status.replaceAll('_', ' ').replace(/^\w/, (character) => character.toUpperCase()),
    tone: 'neutral' as const,
  };
  const palette = badgeColors[tone ?? definition.tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.badgeLabel, { color: palette.color }]}>{label ?? definition.label}</Text>
    </View>
  );
}

export function Field({
  label,
  hint,
  error,
  style,
  ...props
}: TextInputProps & { label: string; hint?: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={colors.muted}
      />
      {error || hint ? (
        <Text style={[styles.fieldHint, error ? styles.error : null]}>{error ?? hint}</Text>
      ) : null}
    </View>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <Card tone="mint" style={styles.emptyState}>
      <Text style={commonStyles.heading}>{title}</Text>
      {body ? <Text style={commonStyles.body}>{body}</Text> : null}
      {action}
    </Card>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  testID,
  danger,
  grow = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  danger?: boolean;
  /** Stretch equally inside a horizontal `buttonRow`. Off by default so column layouts stay content-sized. */
  grow?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        grow && styles.buttonGrow,
        { backgroundColor: danger ? colors.danger : colors.primary },
        pressed && !disabled && styles.pressed,
        disabled && styles.dimmed,
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
  grow = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  /** Stretch equally inside a horizontal `buttonRow`. Off by default so column layouts stay content-sized. */
  grow?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondary,
        grow && styles.buttonGrow,
        pressed && !disabled && styles.secondaryPressed,
        disabled && styles.dimmed,
      ]}>
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
      <View style={styles.asyncStateWrap} testID="async-loading">
        <Card style={styles.asyncStateCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={commonStyles.heading}>Loading…</Text>
          <Text style={commonStyles.body}>Pulling the latest workspace data.</Text>
        </Card>
      </View>
    );
  }
  if (error) {
    const capability = /requires capability/i.test(error.message);
    return (
      <View style={styles.asyncStateWrap} testID="async-error">
        <Card style={styles.asyncStateCard} tone={capability ? 'butter' : 'default'}>
          <Text style={commonStyles.heading}>
            {capability ? 'Limited access' : 'Couldn’t load this screen'}
          </Text>
          <Text style={[commonStyles.body, styles.asyncStateMessage]}>
            {capability
              ? 'Your seat doesn’t include this capability yet. Ask a workspace owner to grant access, or switch seats from Account.'
              : error.message}
          </Text>
          <View style={styles.asyncStateAction}>
            <SecondaryButton label="Try again" onPress={onRetry} />
          </View>
        </Card>
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.asyncStateWrap} testID="async-empty">
        <Card style={styles.asyncStateCard} tone="mint">
          <Text style={commonStyles.heading}>All clear</Text>
          <Text style={[commonStyles.body, styles.asyncStateMessage]}>
            There is nothing waiting for a decision.
          </Text>
        </Card>
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
    minHeight: 36,
    alignSelf: 'stretch',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  buttonGrow: { flex: 1, alignSelf: 'auto' },
  buttonLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  secondary: {
    minHeight: 36,
    alignSelf: 'stretch',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  pressed: { backgroundColor: colors.primaryPressed },
  secondaryPressed: { backgroundColor: colors.surfaceMuted },
  dimmed: { opacity: 0.55 },
  center: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  asyncStateWrap: {
    flex: 1,
    minHeight: 160,
    justifyContent: 'flex-start',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 20,
  },
  asyncStateCard: {
    width: '100%',
    alignItems: 'stretch',
    gap: 8,
  },
  asyncStateMessage: { textAlign: 'left' },
  asyncStateAction: {
    alignSelf: 'stretch',
    marginTop: 2,
  },
  error: { color: colors.danger, textAlign: 'center' },
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  pageHeaderCopy: { flex: 1, gap: 3 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeLabel: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 28,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipLabel: { fontSize: 12, fontWeight: '600' },
  chipCount: {
    minWidth: 18,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignItems: 'center',
  },
  chipCountLabel: { fontSize: 10, fontWeight: '700' },
  tag: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagLabel: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
  searchShell: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    justifyContent: 'center',
    shadowColor: '#262522',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  searchInput: {
    color: colors.text,
    fontSize: 14,
    paddingVertical: 8,
  },
  field: { gap: 4 },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  input: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inputError: { borderColor: colors.danger },
  fieldHint: { color: colors.muted, fontSize: 12 },
  emptyState: { alignItems: 'flex-start', gap: 6 },
  centerText: { textAlign: 'left' },
});
