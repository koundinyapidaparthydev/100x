import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { WorkItem } from '@shared/types';
import { api } from '@/src/api';
import {
  AsyncState,
  colors,
  commonStyles,
  PrimaryButton,
  SecondaryButton,
  useAsync,
  timeAgo,
} from '@/src/ui';

const TARGETS = [10, 20, 30];

export default function TriageScreen() {
  const router = useRouter();
  const query = useAsync(async () => {
    const [items, boards, stats] = await Promise.all([
      api.listWorkItems({ triagePending: true }),
      api.listBoards(),
      api.stats(),
    ]);
    return { items, boards, stats };
  });
  const [project, setProject] = useState('all');
  const [target, setTarget] = useState(20);
  const [busy, setBusy] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const queue = useMemo(
    () =>
      (query.data?.items ?? []).filter(
        (item) => project === 'all' || item.board.projectId === project,
      ),
    [project, query.data?.items],
  );
  const current = queue[0];

  const decide = async (item: WorkItem, decision: 'ai' | 'human') => {
    setBusy(true);
    setDecisionError(null);
    try {
      await api.triageWorkItem(
        item.id,
        decision === 'ai'
          ? { aiFirst: true, targetCompletionPercent: target }
          : { aiFirst: false },
      );
      if (decision === 'ai') router.push(`/ticket/${item.id}`);
      else query.retry();
    } catch (reason) {
      setDecisionError(reason instanceof Error ? reason.message : 'Decision failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={commonStyles.screen}>
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All projects" active={project === 'all'} onPress={() => setProject('all')} />
          {(query.data?.boards ?? []).map((board) => (
            <Chip
              key={board.projectId}
              label={board.projectId}
              active={project === board.projectId}
              onPress={() => setProject(board.projectId)}
            />
          ))}
        </ScrollView>
        <Text style={commonStyles.meta}>
          Token budget: {Math.round(query.data?.stats.tokenBudgetUsedPercent ?? 0)}% used today
        </Text>
        <View style={styles.targetRow}>
          {TARGETS.map((value) => (
            <Chip
              key={value}
              label={`${value}% target`}
              active={target === value}
              onPress={() => setTarget(value)}
            />
          ))}
        </View>
      </View>
      <AsyncState
        loading={query.loading}
        error={query.error}
        empty={!current}
        onRetry={query.retry}>
        {current ? (
          <View style={styles.deck}>
            <SwipeCard
              key={current.id}
              item={current}
              disabled={busy}
              onDecision={(decision) => void decide(current, decision)}
              onOpen={() => router.push(`/ticket/${current.id}`)}
            />
            <Text style={styles.hint}>← Human-first · swipe card · AI-first →</Text>
            {decisionError ? <Text style={styles.error}>{decisionError}</Text> : null}
            <View style={commonStyles.buttonRow}>
              <SecondaryButton
                testID="triage-human-button"
                label="Human-first"
                disabled={busy}
                onPress={() => void decide(current, 'human')}
              />
              <PrimaryButton
                testID="triage-ai-button"
                label={`AI-first (${target}%)`}
                disabled={busy}
                onPress={() => void decide(current, 'ai')}
              />
            </View>
            <Text style={commonStyles.meta}>{queue.length} tickets in queue</Text>
          </View>
        ) : null}
      </AsyncState>
    </View>
  );
}

function SwipeCard({
  item,
  disabled,
  onDecision,
  onOpen,
}: {
  item: WorkItem;
  disabled: boolean;
  onDecision: (decision: 'ai' | 'human') => void;
  onOpen: () => void;
}) {
  const x = useSharedValue(0);
  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onUpdate((event) => {
      x.value = event.translationX;
    })
    .onEnd((event) => {
      const decision =
        event.translationX > 100 || event.velocityX > 650
          ? 'ai'
          : event.translationX < -100 || event.velocityX < -650
            ? 'human'
            : null;
      if (decision) {
        x.value = withTiming(decision === 'ai' ? 500 : -500, { duration: 180 }, () => {
          runOnJS(onDecision)(decision);
        });
      } else {
        x.value = withSpring(0);
      }
    });
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { rotate: `${interpolate(x.value, [-240, 240], [-9, 9])}deg` }],
  }));
  const aiStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, 100], [0, 1]) }));
  const humanStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-100, 0], [1, 0]) }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View testID="triage-swipe-card" style={[commonStyles.card, styles.ticket, cardStyle]}>
        <Animated.Text style={[styles.stamp, styles.aiStamp, aiStyle]}>AI-FIRST</Animated.Text>
        <Animated.Text style={[styles.stamp, styles.humanStamp, humanStyle]}>HUMAN</Animated.Text>
        <View style={commonStyles.row}>
          <Text style={styles.issue}>{item.board.issueKey}</Text>
          <Text style={commonStyles.meta}>{item.priority}</Text>
        </View>
        <Text style={styles.ticketTitle}>{item.title}</Text>
        <Text numberOfLines={6} style={commonStyles.body}>{item.description}</Text>
        <View style={styles.spacer} />
        <Text style={commonStyles.meta}>Updated {timeAgo(item.updatedAt)}</Text>
        <Pressable testID="triage-open-ticket-button" onPress={onOpen} style={styles.details}>
          <Text style={styles.detailsLabel}>Open ticket details</Text>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filters: { padding: 12, gap: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border },
  chips: { gap: 8 },
  targetRow: { flexDirection: 'row', gap: 8 },
  chip: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 7 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  deck: { flex: 1, padding: 16, justifyContent: 'center', gap: 12 },
  ticket: { minHeight: 390, overflow: 'hidden' },
  issue: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  ticketTitle: { color: colors.text, fontWeight: '700', fontSize: 22, lineHeight: 28 },
  spacer: { flex: 1 },
  hint: { color: colors.muted, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  error: { color: colors.danger, textAlign: 'center' },
  stamp: { position: 'absolute', top: 120, zIndex: 2, fontSize: 28, fontWeight: '900', borderWidth: 3, borderRadius: 8, padding: 8 },
  aiStamp: { right: 22, color: colors.primary, borderColor: colors.primary, transform: [{ rotate: '8deg' }] },
  humanStamp: { left: 22, color: colors.danger, borderColor: colors.danger, transform: [{ rotate: '-8deg' }] },
  details: { paddingVertical: 10 },
  detailsLabel: { color: colors.primary, fontWeight: '700' },
});
