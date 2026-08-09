import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
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
  SearchField,
  Tag,
  type TagTone,
  useAsync,
  timeAgo,
} from '@/src/ui';

const SPRING = { damping: 22, stiffness: 220, mass: 0.7 };

type PriorityFilter = 'all' | 'urgent' | 'medium' | 'low';
type SortMode = 'priority' | 'recent' | 'label';
type TargetMode = 'auto' | number;

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

function priorityRank(priority: WorkItem['priority']): number {
  if (priority === 'critical') return 0;
  if (priority === 'high') return 1;
  if (priority === 'medium') return 2;
  return 3;
}

function priorityMeta(priority: WorkItem['priority']): {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  color: string;
  soft: string;
} {
  if (priority === 'critical') {
    return { icon: 'alert-octagon', label: 'Critical', color: colors.danger, soft: colors.dangerSoft };
  }
  if (priority === 'high') {
    return { icon: 'fire', label: 'High priority', color: colors.onBlush, soft: colors.blushSoft };
  }
  if (priority === 'medium') {
    return { icon: 'flash', label: 'Medium', color: colors.onButter, soft: colors.butterSoft };
  }
  return { icon: 'leaf', label: 'Low', color: colors.onMint, soft: colors.mintSoft };
}

function statusMeta(status: string): {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
} {
  const key = status.toLowerCase().replace(/\s+/g, '_');
  if (key.includes('progress') || key === 'in_progress') {
    return { icon: 'progress-clock', label: 'In progress' };
  }
  if (key.includes('review')) return { icon: 'eye-outline', label: 'In review' };
  if (key.includes('done') || key.includes('closed')) return { icon: 'check-circle-outline', label: 'Done' };
  if (key.includes('block')) return { icon: 'cancel', label: status };
  return { icon: 'circle-outline', label: status.replaceAll('_', ' ') };
}

/** Estimate how much of the ticket AI can likely finish before a human review. */
export function estimateTargetPercent(item: WorkItem): number {
  let score = 28;
  if (item.priority === 'critical') score = 14;
  else if (item.priority === 'high') score = 20;
  else if (item.priority === 'medium') score = 30;
  else score = 40;

  const hard = ['security', 'auth', 'pii', 'infra', 'migration', 'compliance', 'credential'];
  const soft = ['docs', 'copy', 'ui', 'a11y', 'accessibility', 'frontend'];
  const labels = item.labels.map((label) => label.toLowerCase());
  if (labels.some((label) => hard.some((token) => label.includes(token)))) score -= 6;
  if (labels.some((label) => soft.some((token) => label.includes(token)))) score += 6;

  const body = `${item.title} ${item.description}`.toLowerCase();
  if (/(ssn|secret|credential|pii|auth|security)/.test(body)) score -= 5;
  if (/(test|docs|copy|typo|style)/.test(body)) score += 4;
  if (item.description.length > 420) score -= 4;
  if (item.description.length < 140) score += 4;

  return Math.max(10, Math.min(50, Math.round(score / 5) * 5));
}

function extractMediaUrls(description: string): string[] {
  const found: string[] = [];
  const markdown = /!\[[^\]]*]\(([^)\s]+)\)/g;
  const bare = /https?:\/\/[^\s)]+\.(?:png|jpe?g|gif|webp)(?:\?[^\s)]*)?/gi;
  for (const match of description.matchAll(markdown)) {
    if (match[1]) found.push(match[1]);
  }
  for (const match of description.matchAll(bare)) {
    found.push(match[0]);
  }
  return [...new Set(found)].slice(0, 3);
}

function displayDescription(description: string): string {
  return description
    .replace(/!\[[^\]]*]\([^)\s]+\)/g, '')
    .replace(/https?:\/\/[^\s)]+\.(?:png|jpe?g|gif|webp)(?:\?[^\s)]*)?/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [search, setSearch] = useState('');
  const [targetMode, setTargetMode] = useState<TargetMode>('auto');
  const [busy, setBusy] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  // Keep decided cards out of the deck while refetch catches up (avoids empty flash).
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());

  const queue = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = (query.data?.items ?? []).filter((item) => {
      if (dismissedIds.has(item.id)) return false;
      if (project !== 'all' && item.board.projectId !== project) return false;
      if (priorityFilter === 'urgent' && !(item.priority === 'high' || item.priority === 'critical')) {
        return false;
      }
      if (priorityFilter === 'medium' && item.priority !== 'medium') return false;
      if (priorityFilter === 'low' && item.priority !== 'low') return false;
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

    return [...filtered].sort((a, b) => {
      if (sortMode === 'recent') {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (sortMode === 'label') {
        const left = a.labels[0] ?? '';
        const right = b.labels[0] ?? '';
        return left.localeCompare(right) || priorityRank(a.priority) - priorityRank(b.priority);
      }
      return (
        priorityRank(a.priority) - priorityRank(b.priority) ||
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
  }, [dismissedIds, priorityFilter, project, query.data?.items, search, sortMode]);

  const current = queue[0];
  const upcoming = queue.slice(1, 3);
  const autoPercent = current ? estimateTargetPercent(current) : 20;
  const effectiveTarget = targetMode === 'auto' ? autoPercent : targetMode;

  const decide = async (item: WorkItem, decision: 'ai' | 'human') => {
    setBusy(true);
    setDecisionError(null);
    // Advance the deck immediately so a swiped-off card does not leave a blank deck.
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
    try {
      const percent = targetMode === 'auto' ? estimateTargetPercent(item) : targetMode;
      await api.triageWorkItem(
        item.id,
        decision === 'ai'
          ? { aiFirst: true, targetCompletionPercent: percent }
          : { aiFirst: false },
      );
      query.retry();
      if (decision === 'ai') router.push(`/ticket/${item.id}`);
    } catch (reason) {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      setDecisionError(reason instanceof Error ? reason.message : 'Decision failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={commonStyles.screen} testID="triage-screen">
      <View style={styles.toolbar}>
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search tickets, labels…"
          accessibilityLabel="Search triage queue"
        />
        <View style={styles.budgetRow}>
          <Text style={styles.budgetText} testID="triage-token-budget">
            Budget {Math.round(query.data?.stats.tokenBudgetUsedPercent ?? 0)}% today
          </Text>
          <View style={styles.targetChips}>
            <Chip
              label={current ? `Auto ~${autoPercent}%` : 'Auto'}
              tone="mint"
              selected={targetMode === 'auto'}
              onPress={() => setTargetMode('auto')}
              testID="triage-target-auto"
            />
            {[15, 25, 40].map((value) => (
              <Chip
                key={value}
                label={`${value}%`}
                tone="mint"
                selected={targetMode === value}
                onPress={() => setTargetMode(value)}
                testID={`triage-target-${value}`}
              />
            ))}
          </View>
        </View>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          contentContainerStyle={styles.chips}>
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
          <Chip
            label="Urgent"
            tone="blush"
            selected={priorityFilter === 'urgent'}
            onPress={() => setPriorityFilter((value) => (value === 'urgent' ? 'all' : 'urgent'))}
          />
          <Chip
            label="Medium"
            tone="butter"
            selected={priorityFilter === 'medium'}
            onPress={() => setPriorityFilter((value) => (value === 'medium' ? 'all' : 'medium'))}
          />
          <Chip
            label="Low"
            tone="mint"
            selected={priorityFilter === 'low'}
            onPress={() => setPriorityFilter((value) => (value === 'low' ? 'all' : 'low'))}
          />
          <Chip
            label="Priority"
            tone="neutral"
            selected={sortMode === 'priority'}
            onPress={() => setSortMode('priority')}
          />
          <Chip
            label="Recent"
            tone="neutral"
            selected={sortMode === 'recent'}
            onPress={() => setSortMode('recent')}
          />
          <Chip
            label="Label"
            tone="neutral"
            selected={sortMode === 'label'}
            onPress={() => setSortMode('label')}
          />
        </ScrollView>
      </View>

      <ScrollView
        style={styles.deckScroll}
        contentContainerStyle={styles.deckContent}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={query.loading} onRefresh={query.retry} />}>
        <AsyncState
          loading={query.loading && !query.data}
          error={query.error}
          empty={!current && !query.loading && !busy}
          onRetry={query.retry}>
          {current ? (
            <View style={styles.deck}>
              <SwipeCard
                key={current.id}
                item={current}
                estimatePercent={effectiveTarget}
                autoMode={targetMode === 'auto'}
                disabled={busy}
                onDecision={(decision) => void decide(current, decision)}
                onOpen={() => router.push(`/ticket/${current.id}`)}
              />
              {decisionError ? <Text style={styles.error}>{decisionError}</Text> : null}
              {upcoming.length ? (
                <View style={styles.upNext} testID="triage-up-next">
                  <Text style={commonStyles.meta}>Up next</Text>
                  {upcoming.map((item, index) => {
                    const meta = priorityMeta(item.priority);
                    const status = statusMeta(item.status);
                    return (
                      <Pressable
                        key={item.id}
                        style={[styles.upNextRow, index === 0 && styles.upNextRowFirst]}
                        onPress={() => router.push(`/ticket/${item.id}`)}>
                        <View style={[styles.upNextIcon, { backgroundColor: meta.soft }]}>
                          <MaterialCommunityIcons name={meta.icon} size={16} color={meta.color} />
                        </View>
                        <View style={styles.upNextCopy}>
                          <View style={styles.upNextTop}>
                            <Text style={styles.upNextKey}>{item.board.issueKey}</Text>
                            <Text style={styles.upNextStatus}>{status.label}</Text>
                          </View>
                          <Text numberOfLines={2} style={styles.upNextTitle}>
                            {item.title}
                          </Text>
                        </View>
                        <View style={styles.upNextAside}>
                          <Text style={[styles.upNextPriority, { color: meta.color }]}>{meta.label}</Text>
                          <Text style={styles.upNextEstimate}>~{estimateTargetPercent(item)}%</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              {/* Detox hooks — nearly invisible but hittable */}
              <View style={styles.e2eHooks} pointerEvents="box-none" collapsable={false}>
                <Pressable
                  testID="triage-ai-button"
                  accessibilityLabel="Send to AI"
                  onPress={() => void decide(current, 'ai')}
                  style={styles.e2eHit}
                  collapsable={false}
                />
                <Pressable
                  testID="triage-human-button"
                  accessibilityLabel="Assign to person"
                  onPress={() => void decide(current, 'human')}
                  style={[styles.e2eHit, styles.e2eHitHuman]}
                  collapsable={false}
                />
              </View>
            </View>
          ) : null}
        </AsyncState>
      </ScrollView>
    </View>
  );
}

function SwipeCard({
  item,
  estimatePercent,
  autoMode,
  disabled,
  onDecision,
  onOpen,
}: {
  item: WorkItem;
  estimatePercent: number;
  autoMode: boolean;
  disabled: boolean;
  onDecision: (decision: 'ai' | 'human') => void;
  onOpen: () => void;
}) {
  const x = useSharedValue(0);
  const tone = priorityCardTone(item.priority);
  const toneFill = CARD_TONE_FILL[tone];
  const priority = priorityMeta(item.priority);
  const status = statusMeta(item.status);
  const media = extractMediaUrls(item.description);

  const open = () => {
    if (!disabled) onOpen();
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-14, 14])
    .failOffsetY([-18, 18])
    .onUpdate((event) => {
      x.value = event.translationX;
    })
    .onEnd((event) => {
      const decision =
        event.translationX > 96 || event.velocityX > 700
          ? 'ai'
          : event.translationX < -96 || event.velocityX < -700
            ? 'human'
            : null;
      if (decision) {
        x.value = withTiming(decision === 'ai' ? 420 : -420, { duration: 200 }, () => {
          runOnJS(onDecision)(decision);
        });
      } else {
        x.value = withSpring(0, SPRING);
      }
    });

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .maxDistance(10)
    .onEnd(() => {
      runOnJS(open)();
    });

  const composed = Gesture.Exclusive(pan, tap);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      {
        rotate: `${interpolate(x.value, [-220, 0, 220], [-7, 0, 7], Extrapolation.CLAMP)}deg`,
      },
      {
        scale: interpolate(x.value, [-220, 0, 220], [0.98, 1, 0.98], Extrapolation.CLAMP),
      },
    ],
  }));
  const aiStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, 80], [0, 1], Extrapolation.CLAMP),
  }));
  const humanStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-80, 0], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        testID="triage-swipe-card"
        accessibilityRole="button"
        accessibilityLabel={`${item.board.issueKey}. ${item.title}. Tap to open. Swipe right for AI, left to assign.`}
        style={[commonStyles.card, toneFill, styles.ticket, cardStyle]}>
        <Animated.Text style={[styles.stamp, styles.aiStamp, aiStyle]}>SEND TO AI</Animated.Text>
        <Animated.Text style={[styles.stamp, styles.humanStamp, humanStyle]}>ASSIGN</Animated.Text>

        <View style={styles.badgeRow}>
          <Text style={styles.issue}>{item.board.issueKey}</Text>
          <View style={[styles.priorityPill, { backgroundColor: priority.soft }]}>
            <MaterialCommunityIcons name={priority.icon} size={14} color={priority.color} />
            <Text style={[styles.priorityLabel, { color: priority.color }]}>{priority.label}</Text>
          </View>
          <View style={styles.statusPill}>
            <MaterialCommunityIcons name={status.icon} size={13} color={colors.muted} />
            <Text style={styles.statusLabel}>{status.label}</Text>
          </View>
        </View>

        <Text style={styles.ticketTitle}>{item.title}</Text>

        {media.length ? (
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mediaRow}>
            {media.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.mediaThumb} resizeMode="cover" />
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.heroStrip, { backgroundColor: priority.soft }]}>
            <MaterialCommunityIcons name={priority.icon} size={28} color={priority.color} />
            <View style={styles.heroCopy}>
              <Text style={[styles.heroTitle, { color: priority.color }]}>{priority.label}</Text>
              <Text style={styles.heroBody}>
                {autoMode
                  ? `Estimated AI can finish about ${estimatePercent}% before review`
                  : `AI target locked at ${estimatePercent}%`}
              </Text>
            </View>
          </View>
        )}

        {item.labels.length ? (
          <View style={styles.tags}>
            {item.labels.map((label) => (
              <Tag key={label} label={label} tone={priorityTagTone(item.priority)} />
            ))}
          </View>
        ) : null}

        <Text numberOfLines={8} style={styles.description}>
          {displayDescription(item.description)}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.footerMeta}>
            <MaterialCommunityIcons name="clock-outline" size={13} color={colors.muted} />
            <Text style={commonStyles.meta}>Updated {timeAgo(item.updatedAt)}</Text>
          </View>
          {item.assigneeExternalId ? (
            <View style={styles.footerMeta}>
              <MaterialCommunityIcons name="account-outline" size={13} color={colors.muted} />
              <Text style={commonStyles.meta}>{item.assigneeExternalId}</Text>
            </View>
          ) : (
            <View style={styles.footerMeta}>
              <MaterialCommunityIcons name="account-off-outline" size={13} color={colors.muted} />
              <Text style={commonStyles.meta}>Unassigned</Text>
            </View>
          )}
        </View>

        <View style={styles.swipeHint}>
          <Text style={styles.swipeHintText}>← Assign · tap card to open · AI →</Text>
        </View>

        {/* Detox: tap target still addressable when Exclusive gesture owns the card */}
        <Pressable
          testID="triage-open-ticket-button"
          accessibilityLabel="Open ticket"
          onPress={open}
          style={styles.e2eOpenHit}
          collapsable={false}
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  budgetText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    flexShrink: 0,
  },
  targetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', flex: 1 },
  chips: { gap: 6, paddingRight: 8, alignItems: 'center' },
  deckScroll: { flex: 1 },
  deckContent: { flexGrow: 1, paddingBottom: 16 },
  deck: { flex: 1, padding: 12, gap: 12 },
  ticket: {
    minHeight: 460,
    flexGrow: 1,
    overflow: 'hidden',
    gap: 10,
    padding: 14,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  issue: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priorityLabel: { fontSize: 11, fontWeight: '700' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statusLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  ticketTitle: { color: colors.text, fontWeight: '700', fontSize: 18, lineHeight: 24 },
  mediaRow: { gap: 8 },
  mediaThumb: {
    width: 112,
    height: 80,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  heroStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  heroCopy: { flex: 1, gap: 2 },
  heroTitle: { fontSize: 13, fontWeight: '700' },
  heroBody: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  description: { color: colors.muted, fontSize: 13, lineHeight: 19, flexGrow: 1 },
  cardFooter: { gap: 6, marginTop: 4 },
  footerMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swipeHint: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  swipeHintText: {
    color: colors.muted,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  upNext: {
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  upNextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  upNextRowFirst: { borderTopWidth: 0, paddingTop: 2 },
  upNextIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  upNextCopy: { flex: 1, gap: 2 },
  upNextTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  upNextKey: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  upNextStatus: { color: colors.muted, fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  upNextTitle: { color: colors.text, fontSize: 13, fontWeight: '600', lineHeight: 17 },
  upNextAside: { alignItems: 'flex-end', gap: 2, paddingTop: 2 },
  upNextPriority: { fontSize: 10, fontWeight: '700' },
  upNextEstimate: { color: colors.mint, fontSize: 11, fontWeight: '700' },
  error: { color: colors.danger, textAlign: 'center', fontSize: 12 },
  stamp: {
    position: 'absolute',
    top: 120,
    zIndex: 2,
    fontSize: 18,
    fontWeight: '800',
    borderWidth: 2,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  aiStamp: {
    right: 16,
    color: colors.mint,
    borderColor: colors.mint,
    transform: [{ rotate: '8deg' }],
  },
  humanStamp: {
    left: 16,
    color: colors.blush,
    borderColor: colors.blush,
    transform: [{ rotate: '-8deg' }],
  },
  e2eHooks: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 88,
    height: 44,
    opacity: 0.02,
  },
  e2eHit: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 44,
    height: 44,
  },
  e2eHitHuman: {
    left: 44,
  },
  e2eOpenHit: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 44,
    height: 44,
    opacity: 0.02,
  },
});
