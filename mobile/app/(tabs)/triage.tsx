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
  type CardTone,
  Chip,
  colors,
  commonStyles,
  PageHeader,
  PrimaryButton,
  SearchField,
  SecondaryButton,
  StatusBadge,
  Tag,
  type TagTone,
  useAsync,
  timeAgo,
} from '@/src/ui';

const TARGETS = [10, 20, 30];

function priorityCardTone(priority: WorkItem['priority']): Exclude<CardTone, 'default'> {
  if (priority === 'critical' || priority === 'high') return 'blush';
  if (priority === 'medium') return 'butter';
  return 'mint';
}

function priorityTagTone(priority: WorkItem['priority']): TagTone {
  if (priority === 'critical' || priority === 'high') return 'blush';
  if (priority === 'medium') return 'butter';
  return 'mint';
}

const CARD_TONE_FILL: Record<Exclude<CardTone, 'default'>, object> = {
  mint: { backgroundColor: colors.mintSoft, borderColor: 'rgba(63,122,98,0.22)' },
  butter: { backgroundColor: colors.butterSoft, borderColor: 'rgba(154,116,32,0.22)' },
  blush: { backgroundColor: colors.blushSoft, borderColor: 'rgba(176,90,90,0.22)' },
};

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
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState(20);
  const [busy, setBusy] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const queue = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (query.data?.items ?? []).filter((item) => {
      if (project !== 'all' && item.board.projectId !== project) return false;
      if (!needle) return true;
      const haystack = [
        item.title,
        item.board.issueKey,
        item.priority,
        item.status,
        ...item.labels,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [project, query.data?.items, search]);
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
      <View style={styles.header}>
        <PageHeader
          eyebrow="Discover"
          title="Triage"
          description="Swipe or tap to send work to AI or assign a person."
        />
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search tickets, labels, priority…"
          accessibilityLabel="Search triage queue"
        />
      </View>
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip
            label="All projects"
            tone="primary"
            selected={project === 'all'}
            onPress={() => setProject('all')}
          />
          {(query.data?.boards ?? []).map((board) => (
            <Chip
              key={board.projectId}
              label={board.projectId}
              tone="primary"
              selected={project === board.projectId}
              onPress={() => setProject(board.projectId)}
            />
          ))}
        </ScrollView>
        <Text style={commonStyles.meta}>
          Token budget: {Math.round(query.data?.stats.tokenBudgetUsedPercent ?? 0)}% used today
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {TARGETS.map((value) => (
            <Chip
              key={value}
              label={`${value}% target`}
              tone="mint"
              selected={target === value}
              onPress={() => setTarget(value)}
            />
          ))}
        </ScrollView>
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
            <Text style={styles.hint}>← Assign to person · swipe card · Send to AI →</Text>
            {decisionError ? <Text style={styles.error}>{decisionError}</Text> : null}
            <View style={commonStyles.buttonRow}>
              <SecondaryButton
                testID="triage-human-button"
                label="Assign to person"
                disabled={busy}
                onPress={() => void decide(current, 'human')}
              />
              <PrimaryButton
                testID="triage-ai-button"
                label={`Send to AI (${target}% target)`}
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
  const tone = priorityCardTone(item.priority);
  const toneFill = CARD_TONE_FILL[tone];
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
      <Animated.View
        testID="triage-swipe-card"
        style={[commonStyles.card, toneFill, styles.ticket, cardStyle]}>
        <Animated.Text style={[styles.stamp, styles.aiStamp, aiStyle]}>SEND TO AI</Animated.Text>
        <Animated.Text style={[styles.stamp, styles.humanStamp, humanStyle]}>ASSIGN</Animated.Text>
        <View style={styles.badgeRow}>
          <Text style={styles.issue}>{item.board.issueKey}</Text>
          <StatusBadge status={item.priority} label={item.priority} tone={item.priority === 'critical' || item.priority === 'high' ? 'danger' : item.priority === 'medium' ? 'warning' : 'info'} />
          <StatusBadge status={item.status} />
        </View>
        <Text style={styles.ticketTitle}>{item.title}</Text>
        {item.labels.length ? (
          <View style={styles.tags}>
            {item.labels.map((label) => (
              <Tag key={label} label={label} tone={priorityTagTone(item.priority)} />
            ))}
          </View>
        ) : null}
        <Text numberOfLines={5} style={commonStyles.body}>{item.description}</Text>
        <View style={styles.spacer} />
        <Text style={commonStyles.meta}>Updated {timeAgo(item.updatedAt)}</Text>
        <Pressable testID="triage-open-ticket-button" onPress={onOpen} style={styles.details}>
          <Text style={styles.detailsLabel}>Open ticket details</Text>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  filters: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  chips: { gap: 8, paddingRight: 8 },
  deck: { flex: 1, padding: 16, justifyContent: 'center', gap: 12 },
  ticket: { minHeight: 390, overflow: 'hidden' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  issue: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  ticketTitle: { color: colors.text, fontWeight: '700', fontSize: 22, lineHeight: 28 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  spacer: { flex: 1 },
  hint: { color: colors.muted, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  error: { color: colors.danger, textAlign: 'center' },
  stamp: {
    position: 'absolute',
    top: 120,
    zIndex: 2,
    fontSize: 28,
    fontWeight: '900',
    borderWidth: 3,
    borderRadius: 8,
    padding: 8,
  },
  aiStamp: {
    right: 22,
    color: colors.mint,
    borderColor: colors.mint,
    transform: [{ rotate: '8deg' }],
  },
  humanStamp: {
    left: 22,
    color: colors.blush,
    borderColor: colors.blush,
    transform: [{ rotate: '-8deg' }],
  },
  details: { paddingVertical: 10 },
  detailsLabel: { color: colors.primary, fontWeight: '700' },
});
