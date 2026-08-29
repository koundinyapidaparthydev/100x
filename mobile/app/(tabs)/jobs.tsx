import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AiJob, AiJobState, WorkItem } from '@shared/types';
import { api } from '@/src/api';
import {
  AsyncState,
  type CardTone,
  Card,
  Chip,
  colors,
  commonStyles,
  EmptyState,
  formatTokens,
  PageHeader,
  SearchField,
  StatusBadge,
  Tag,
  type TagTone,
  timeAgo,
  useAsync,
} from '@/src/ui';

const JOBS_PREFS_KEY = '100x.mobile.jobs.prefs.v1';

type StatusFilter = 'all' | 'review' | 'active' | 'blocked' | 'failed';
type SortMode = 'recent' | 'tokens' | 'status' | 'priority';
type Density = 'comfortable' | 'compact';

type JobsPrefs = {
  showDescription: boolean;
  showTokenBreakdown: boolean;
  showExecution: boolean;
  density: Density;
};

const DEFAULT_PREFS: JobsPrefs = {
  showDescription: true,
  showTokenBreakdown: true,
  showExecution: true,
  density: 'comfortable',
};

type JobRow = {
  job: AiJob;
  workItem: WorkItem | null;
};

const ACTIVE_STATES: AiJobState[] = [
  'queued',
  'sanitizing',
  'enriching_mcp',
  'running',
  'packaging',
  'attaching',
];

const STATUS_RANK: Record<AiJobState, number> = {
  ready_for_human: 0,
  blocked_pii: 1,
  failed: 2,
  running: 3,
  packaging: 4,
  attaching: 5,
  enriching_mcp: 6,
  sanitizing: 7,
  queued: 8,
  cancelled: 9,
};

function jobCardTone(status: AiJob['state']): CardTone {
  if (status === 'blocked_pii' || status === 'failed') return 'blush';
  if (status === 'ready_for_human') return 'butter';
  if (ACTIVE_STATES.includes(status)) return 'mint';
  return 'default';
}

function priorityTone(priority: WorkItem['priority'] | undefined): TagTone {
  if (priority === 'critical' || priority === 'high') return 'blush';
  if (priority === 'medium') return 'butter';
  if (priority === 'low') return 'mint';
  return 'neutral';
}

function priorityRank(priority: WorkItem['priority'] | undefined): number {
  if (priority === 'critical') return 0;
  if (priority === 'high') return 1;
  if (priority === 'medium') return 2;
  if (priority === 'low') return 3;
  return 4;
}

function matchesStatusFilter(state: AiJobState, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'review') return state === 'ready_for_human';
  if (filter === 'active') return ACTIVE_STATES.includes(state);
  if (filter === 'blocked') return state === 'blocked_pii';
  if (filter === 'failed') return state === 'failed' || state === 'cancelled';
  return true;
}

function snippet(text: string, max = 140): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

function cloudLabel(job: AiJob): string {
  const custom = job.cloudExecution.customLabel;
  const provider = custom ?? job.cloudExecution.provider;
  return `${provider} · ${job.cloudExecution.region}`;
}

function artifactHint(job: AiJob): string | null {
  if (job.error) return job.error;
  if (job.state === 'blocked_pii') {
    const categories = job.piiReport.blocks.length
      ? job.piiReport.blocks.map((block) => block.replaceAll('_', ' ')).join(', ')
      : 'sensitive data';
    return `Blocked before model run · ${categories}`;
  }
  const first = job.artifacts[0];
  if (first?.preview) return first.preview;
  if (job.state === 'ready_for_human') return 'Draft ready — open to review artifacts.';
  if (ACTIVE_STATES.includes(job.state)) {
    return 'Model run in flight. Context and tokens update as the job advances.';
  }
  return null;
}

export default function JobsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [project, setProject] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('status');
  const [prefs, setPrefs] = useState<JobsPrefs>(DEFAULT_PREFS);
  const [prefsReady, setPrefsReady] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(JOBS_PREFS_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        try {
          const parsed = JSON.parse(raw) as Partial<JobsPrefs>;
          setPrefs({ ...DEFAULT_PREFS, ...parsed });
        } catch {
          // Keep defaults when prefs are corrupt.
        }
      })
      .finally(() => active && setPrefsReady(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    void AsyncStorage.setItem(JOBS_PREFS_KEY, JSON.stringify(prefs));
  }, [prefs, prefsReady]);

  const query = useAsync(async () => {
    const [jobs, workItems, stats, boards] = await Promise.all([
      api.listJobs(),
      api.listWorkItems(),
      api.stats(),
      api.listBoards(),
    ]);
    const byId = new Map(workItems.map((item) => [item.id, item]));
    const rows: JobRow[] = jobs.map((job) => ({
      job,
      workItem: byId.get(job.workItemId) ?? null,
    }));
    return { rows, stats, boards, jobs };
  });

  const counts = useMemo(() => {
    const jobs = query.data?.jobs ?? [];
    return {
      all: jobs.length,
      review: jobs.filter((job) => job.state === 'ready_for_human').length,
      active: jobs.filter((job) => ACTIVE_STATES.includes(job.state)).length,
      blocked: jobs.filter((job) => job.state === 'blocked_pii').length,
      failed: jobs.filter((job) => job.state === 'failed' || job.state === 'cancelled').length,
    };
  }, [query.data?.jobs]);

  const projects = useMemo(() => {
    const ids = new Set<string>();
    for (const board of query.data?.boards ?? []) ids.add(board.projectId);
    for (const row of query.data?.rows ?? []) {
      if (row.workItem?.board.projectId) ids.add(row.workItem.board.projectId);
    }
    return [...ids].sort();
  }, [query.data?.boards, query.data?.rows]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = (query.data?.rows ?? []).filter(({ job, workItem }) => {
      if (!matchesStatusFilter(job.state, statusFilter)) return false;
      if (project !== 'all' && workItem?.board.projectId !== project) return false;
      if (!needle) return true;
      const haystack = [
        job.id,
        job.workItemId,
        job.state,
        job.model.modelId,
        job.error ?? '',
        ...(job.artifacts.map((artifact) => `${artifact.kind} ${artifact.preview}`)),
        workItem?.title ?? '',
        workItem?.description ?? '',
        workItem?.board.issueKey ?? '',
        workItem?.board.projectId ?? '',
        ...(workItem?.labels ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });

    return [...filtered].sort((left, right) => {
      if (sortMode === 'tokens') {
        return right.job.tokenUsage.total - left.job.tokenUsage.total;
      }
      if (sortMode === 'priority') {
        return (
          priorityRank(left.workItem?.priority) - priorityRank(right.workItem?.priority) ||
          new Date(right.job.createdAt).getTime() - new Date(left.job.createdAt).getTime()
        );
      }
      if (sortMode === 'recent') {
        return new Date(right.job.createdAt).getTime() - new Date(left.job.createdAt).getTime();
      }
      return (
        STATUS_RANK[left.job.state] - STATUS_RANK[right.job.state] ||
        new Date(right.job.createdAt).getTime() - new Date(left.job.createdAt).getTime()
      );
    });
  }, [project, query.data?.rows, search, sortMode, statusFilter]);

  const updatePref = <K extends keyof JobsPrefs>(key: K, value: JobsPrefs[K]) => {
    setPrefs((current) => ({ ...current, [key]: value }));
  };

  const comfortable = prefs.density === 'comfortable';

  return (
    <AsyncState loading={query.loading} error={query.error} onRetry={query.retry}>
      <ScrollView
        testID="jobs-screen"
        style={commonStyles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        refreshControl={<RefreshControl refreshing={query.loading} onRefresh={query.retry} />}>
        <PageHeader
          title="AI Jobs"
          description="State filters, ticket context, and card display controls."
          action={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Customize job cards"
              testID="jobs-customize-toggle"
              onPress={() => setShowCustomize((value) => !value)}
              style={({ pressed }) => [styles.customizeBtn, pressed && styles.customizePressed]}
            >
              <Text style={styles.customizeLabel}>{showCustomize ? 'Done' : 'Customize'}</Text>
            </Pressable>
          }
        />

        {query.data ? (
          <>
            <Card tone="mint" style={styles.stats} testID="jobs-stats">
              <Pressable
                style={styles.statBlock}
                onPress={() => setStatusFilter('review')}
                accessibilityRole="button"
                accessibilityLabel="Filter needs review"
              >
                <Text style={styles.stat}>{query.data.stats.readyForHuman}</Text>
                <Text style={commonStyles.meta}>Needs review</Text>
              </Pressable>
              <Pressable
                style={styles.statBlock}
                onPress={() => setStatusFilter('active')}
                accessibilityRole="button"
                accessibilityLabel="Filter in flight jobs"
              >
                <Text style={styles.stat}>{query.data.stats.queuedJobs}</Text>
                <Text style={commonStyles.meta}>Queued</Text>
              </Pressable>
              <Pressable
                style={styles.statBlock}
                onPress={() => setStatusFilter('blocked')}
                accessibilityRole="button"
                accessibilityLabel="Filter blocked jobs"
              >
                <Text style={[styles.stat, styles.blocked]}>{query.data.stats.piiBlocks24h}</Text>
                <Text style={commonStyles.meta}>Blocked today</Text>
              </Pressable>
              <View style={styles.statBlock}>
                <Text style={styles.stat}>{formatTokens(query.data.stats.tokenUsageToday.total)}</Text>
                <Text style={commonStyles.meta}>Tokens today</Text>
              </View>
            </Card>

            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder="Search title, issue key, model…"
              accessibilityLabel="Search AI jobs"
              testID="jobs-search"
            />

            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              contentContainerStyle={styles.chips}
            >
              {(
                [
                  ['all', 'All', 'primary', counts.all],
                  ['review', 'Needs review', 'butter', counts.review],
                  ['active', 'In flight', 'mint', counts.active],
                  ['blocked', 'Blocked', 'blush', counts.blocked],
                  ['failed', 'Failed', 'blush', counts.failed],
                ] as const
              ).map(([id, label, tone, count]) => (
                <Chip
                  key={id}
                  label={label}
                  tone={tone}
                  count={count}
                  selected={statusFilter === id}
                  onPress={() => setStatusFilter(id)}
                  testID={`jobs-filter-${id}`}
                />
              ))}
            </ScrollView>

            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              contentContainerStyle={styles.chips}
            >
              <Chip
                label="All projects"
                tone="primary"
                selected={project === 'all'}
                onPress={() => setProject('all')}
              />
              {projects.map((id) => (
                <Chip
                  key={id}
                  label={id}
                  tone="primary"
                  selected={project === id}
                  onPress={() => setProject(id)}
                />
              ))}
              {(
                [
                  ['status', 'Attention'],
                  ['recent', 'Recent'],
                  ['priority', 'Priority'],
                  ['tokens', 'Tokens'],
                ] as const
              ).map(([id, label]) => (
                <Chip
                  key={id}
                  label={`Sort · ${label}`}
                  tone="neutral"
                  selected={sortMode === id}
                  onPress={() => setSortMode(id)}
                  testID={`jobs-sort-${id}`}
                />
              ))}
            </ScrollView>

            {showCustomize ? (
              <Card tone="butter" testID="jobs-customize-panel">
                <Text style={commonStyles.heading}>Card display</Text>
                <Text style={commonStyles.body}>
                  Choose density and which context stays visible so the list does not feel empty.
                </Text>
                <View style={styles.prefRow}>
                  <Chip
                    label="Comfortable"
                    tone="mint"
                    selected={prefs.density === 'comfortable'}
                    onPress={() => updatePref('density', 'comfortable')}
                    testID="jobs-density-comfortable"
                  />
                  <Chip
                    label="Compact"
                    tone="mint"
                    selected={prefs.density === 'compact'}
                    onPress={() => updatePref('density', 'compact')}
                    testID="jobs-density-compact"
                  />
                </View>
                <View style={styles.prefRow}>
                  <Chip
                    label="Description"
                    tone="butter"
                    selected={prefs.showDescription}
                    onPress={() => updatePref('showDescription', !prefs.showDescription)}
                    testID="jobs-pref-description"
                  />
                  <Chip
                    label="Token split"
                    tone="butter"
                    selected={prefs.showTokenBreakdown}
                    onPress={() => updatePref('showTokenBreakdown', !prefs.showTokenBreakdown)}
                    testID="jobs-pref-tokens"
                  />
                  <Chip
                    label="Where it runs"
                    tone="butter"
                    selected={prefs.showExecution}
                    onPress={() => updatePref('showExecution', !prefs.showExecution)}
                    testID="jobs-pref-execution"
                  />
                </View>
              </Card>
            ) : null}

            <Text style={styles.resultMeta} testID="jobs-result-count">
              Showing {visible.length} of {counts.all} jobs
            </Text>

            {visible.length === 0 ? (
              <EmptyState
                title={counts.all === 0 ? 'No AI jobs yet' : 'No jobs match these filters'}
                body={
                  counts.all === 0
                    ? 'Send a ticket to AI from Triage to create a job.'
                    : 'Clear search or switch filters to see more activity.'
                }
              />
            ) : (
              visible.map(({ job, workItem }) => {
                const hint = artifactHint(job);
                const issueKey = workItem?.board.issueKey ?? job.workItemId;
                const title = workItem?.title ?? 'Work item unavailable';
                return (
                  <Pressable
                    key={job.id}
                    testID={`jobs-card-${job.id}`}
                    onPress={() => router.push(`/ticket/${job.workItemId}`)}
                  >
                    <Card tone={jobCardTone(job.state)} style={!comfortable ? styles.compactCard : undefined}>
                      <View style={styles.between}>
                        <View style={styles.titleBlock}>
                          <Text style={commonStyles.meta}>{issueKey}</Text>
                          <Text style={styles.jobTitle} numberOfLines={comfortable ? 3 : 2}>
                            {title}
                          </Text>
                        </View>
                        <StatusBadge status={job.state} />
                      </View>

                      <View style={styles.metaRow}>
                        {workItem ? (
                          <Tag label={workItem.priority} tone={priorityTone(workItem.priority)} />
                        ) : null}
                        <Tag label={job.model.modelId} tone="neutral" />
                        {workItem?.labels.slice(0, 2).map((label) => (
                          <Tag key={label} label={label} tone="primary" />
                        ))}
                        {job.artifacts.length > 0 ? (
                          <Tag
                            label={`${job.artifacts.length} artifact${job.artifacts.length === 1 ? '' : 's'}`}
                            tone="butter"
                          />
                        ) : null}
                        {job.piiReport.redactions > 0 ? (
                          <Tag label={`${job.piiReport.redactions} redactions`} tone="blush" />
                        ) : null}
                      </View>

                      {prefs.showDescription && workItem?.description && job.state !== 'blocked_pii' ? (
                        <Text style={styles.context} numberOfLines={comfortable ? 3 : 2}>
                          {snippet(workItem.description, comfortable ? 160 : 100)}
                        </Text>
                      ) : null}

                      {hint ? (
                        <View style={styles.hintBox}>
                          <Text style={commonStyles.meta}>
                            {job.artifacts.length
                              ? 'Latest draft'
                              : job.state === 'blocked_pii'
                                ? 'Block reason'
                                : 'Job context'}
                          </Text>
                          <Text style={styles.hintBody} numberOfLines={comfortable ? 3 : 2}>
                            {snippet(hint, comfortable ? 160 : 100)}
                          </Text>
                        </View>
                      ) : null}

                      {prefs.showTokenBreakdown ? (
                        <View style={styles.tokenRow}>
                          <View style={styles.tokenCell}>
                            <Text style={commonStyles.meta}>In</Text>
                            <Text style={styles.tokenValue}>{formatTokens(job.tokenUsage.input)}</Text>
                          </View>
                          <View style={styles.tokenCell}>
                            <Text style={commonStyles.meta}>Out</Text>
                            <Text style={styles.tokenValue}>{formatTokens(job.tokenUsage.output)}</Text>
                          </View>
                          <View style={styles.tokenCell}>
                            <Text style={commonStyles.meta}>Total</Text>
                            <Text style={styles.tokenValue}>{formatTokens(job.tokenUsage.total)}</Text>
                          </View>
                          {workItem ? (
                            <View style={styles.tokenCell}>
                              <Text style={commonStyles.meta}>AI target</Text>
                              <Text style={styles.tokenValue}>{workItem.targetCompletionPercent}%</Text>
                            </View>
                          ) : null}
                        </View>
                      ) : (
                        <Text style={commonStyles.meta}>
                          {formatTokens(job.tokenUsage.total)} tokens · started {timeAgo(job.createdAt)}
                        </Text>
                      )}

                      <View style={styles.footerRow}>
                        <Text style={commonStyles.meta}>
                          Started {timeAgo(job.createdAt)}
                          {job.finishedAt ? ` · finished ${timeAgo(job.finishedAt)}` : ''}
                        </Text>
                        {prefs.showExecution ? (
                          <Text style={styles.execution} numberOfLines={1}>
                            {cloudLabel(job)}
                          </Text>
                        ) : null}
                      </View>
                    </Card>
                  </Pressable>
                );
              })
            )}
          </>
        ) : null}
      </ScrollView>
    </AsyncState>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, paddingBottom: 28, gap: 8 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, paddingVertical: 10 },
  statBlock: { flex: 1, gap: 2 },
  stat: { color: colors.primary, fontSize: 17, fontWeight: '700' },
  blocked: { color: colors.danger },
  chips: { gap: 6, paddingRight: 8, alignItems: 'center' },
  customizeBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  customizePressed: { opacity: 0.85 },
  customizeLabel: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  prefRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  resultMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  between: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  titleBlock: { flex: 1, gap: 2 },
  jobTitle: { color: colors.text, fontWeight: '700', fontSize: 15, lineHeight: 20 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  context: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  hintBox: {
    backgroundColor: 'rgba(38,37,34,0.04)',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  hintBody: { color: colors.text, fontSize: 13, lineHeight: 18 },
  tokenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  tokenCell: { minWidth: 64, gap: 2 },
  tokenValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  execution: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  compactCard: { gap: 6, padding: 10 },
});
