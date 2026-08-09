import { useRouter } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BoardHealth, ServiceMcpConnection } from '@shared/types';
import { api } from '@/src/api';
import { useSession } from '@/src/session';
import {
  Card,
  Chip,
  colors,
  commonStyles,
  formatTokens,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  Tag,
  timeAgo,
  useAsync,
} from '@/src/ui';

function boardTone(state: BoardHealth['state']): 'mint' | 'butter' | 'blush' | 'neutral' {
  if (state === 'healthy') return 'mint';
  if (state === 'syncing' || state === 'queued') return 'butter';
  return 'blush';
}

function connectionTone(status: ServiceMcpConnection['status']): 'mint' | 'butter' | 'blush' | 'neutral' {
  if (status === 'connected') return 'mint';
  if (status === 'pending') return 'butter';
  if (status === 'error') return 'blush';
  return 'neutral';
}

export default function AccountScreen() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const query = useAsync(async () => {
    const [meRes, statsRes, boardsRes, mcpRes] = await Promise.allSettled([
      api.me(),
      api.stats(),
      api.listBoards(),
      api.listMcpConnections(),
    ]);
    const me = meRes.status === 'fulfilled' ? meRes.value.user : session?.user ?? null;
    const stats = statsRes.status === 'fulfilled' ? statsRes.value : null;
    const boards = boardsRes.status === 'fulfilled' ? boardsRes.value : [];
    const mcp =
      mcpRes.status === 'fulfilled'
        ? mcpRes.value
        : { connections: [] as ServiceMcpConnection[], environmentId: undefined };
    const mcpError =
      mcpRes.status === 'rejected'
        ? mcpRes.reason instanceof Error
          ? mcpRes.reason.message
          : String(mcpRes.reason)
        : null;
    if (!me && !stats) {
      throw new Error(
        meRes.status === 'rejected'
          ? meRes.reason instanceof Error
            ? meRes.reason.message
            : String(meRes.reason)
          : 'Could not load account',
      );
    }
    return { me, stats, boards, mcp, mcpError };
  }, [session?.token]);

  const user = query.data?.me ?? session?.user;
  const roleLabel = user?.isWorkspaceOwner
    ? 'Workspace owner'
    : user?.roleId
      ? `Role · ${user.roleId}`
      : 'Member';

  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.content}
      testID="account-screen"
      showsVerticalScrollIndicator={false}
      decelerationRate="fast"
      refreshControl={<RefreshControl refreshing={query.loading} onRefresh={query.retry} />}>
      <PageHeader
        title="Workspace"
        description="Pulse and read-only connection status."
        eyebrow="You"
      />

      <Card testID="account-profile" tone="mint">
        <Text style={commonStyles.meta}>Profile</Text>
        <Text style={styles.displayName}>{user?.displayName ?? '—'}</Text>
        <Text style={commonStyles.body}>{user?.email ?? '—'}</Text>
        <View style={styles.chipRow}>
          <Tag label={roleLabel} tone={user?.isWorkspaceOwner ? 'mint' : 'neutral'} />
          {user?.surface ? <Tag label={user.surface} tone="primary" /> : null}
        </View>
      </Card>

      {query.loading && !query.data ? (
        <Card testID="account-pulse-loading">
          <ActivityIndicator color={colors.primary} />
          <Text style={commonStyles.meta}>Loading workspace…</Text>
        </Card>
      ) : null}

      {query.error && !query.data ? (
        <Card testID="account-pulse-error" tone="butter">
          <Text style={commonStyles.heading}>Couldn’t load workspace</Text>
          <Text style={commonStyles.body}>{query.error.message}</Text>
          <SecondaryButton label="Try again" onPress={query.retry} />
        </Card>
      ) : null}

      {query.data?.stats ? (
        <Card testID="account-pulse">
          <Text style={commonStyles.heading}>Workspace pulse</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.stat}>{query.data.stats.readyForHuman}</Text>
              <Text style={commonStyles.meta}>Review</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.stat}>{query.data.stats.activeJobs}</Text>
              <Text style={commonStyles.meta}>Jobs</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.stat}>{query.data.stats.piiBlocks24h}</Text>
              <Text style={commonStyles.meta}>PII</Text>
            </View>
          </View>
          <Text style={commonStyles.body}>
            Tokens today · {formatTokens(query.data.stats.tokenUsageToday.total)} (
            {query.data.stats.tokenBudgetUsedPercent}% budget)
          </Text>

          <Text style={[commonStyles.meta, styles.sectionLabel]}>Boards</Text>
          {query.data.boards.length === 0 ? (
            <Text style={commonStyles.body}>No boards yet — connect from the web app.</Text>
          ) : (
            query.data.boards.map((board) => (
              <View key={board.projectId} style={styles.listRow} testID={`account-board-${board.projectId}`}>
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle}>{board.name}</Text>
                  <Text style={commonStyles.meta}>
                    {board.activeIssues} open · {timeAgo(board.lastSyncAt)}
                  </Text>
                </View>
                <Chip label={board.state} tone={boardTone(board.state)} />
              </View>
            ))
          )}
        </Card>
      ) : null}

      {query.data ? (
        <Card testID="account-connections">
          <Text style={commonStyles.heading}>How things connect</Text>
          <Text style={commonStyles.body}>
            Board tickets → Triage decisions → AI Jobs → Approvals / PII. MCP status is read-only here.
          </Text>
          {query.data.mcpError ? (
            <Text style={[commonStyles.body, styles.warnCopy]} testID="account-connections-limited">
              Connections limited for this seat ({query.data.mcpError}). Owners can grant access on web.
            </Text>
          ) : null}
          {query.data.mcp.connections.length === 0 && !query.data.mcpError ? (
            <Text style={commonStyles.body} testID="account-connections-empty">
              No MCP services linked yet. Manage on the desktop web app.
            </Text>
          ) : (
            query.data.mcp.connections.map((connection) => (
              <View
                key={`${connection.environmentId}-${connection.serviceId}`}
                style={styles.listRow}
                testID={`account-mcp-${connection.serviceId}`}>
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle}>{connection.serviceId}</Text>
                  <Text style={commonStyles.meta}>
                    {connection.live ? 'Live' : connection.authState ?? 'Offline'}
                  </Text>
                </View>
                <Chip label={connection.status} tone={connectionTone(connection.status)} />
              </View>
            ))
          )}
          <Text style={[commonStyles.meta, styles.manageWeb]} testID="account-manage-on-web">
            Manage connections on web
          </Text>
        </Card>
      ) : null}

      <SecondaryButton
        testID="account-how-it-works"
        label="View how it works"
        onPress={() => router.push('/onboarding?from=account')}
      />

      <PrimaryButton
        testID="account-sign-out"
        danger
        label="Sign out"
        onPress={() => {
          void signOut().then(() => router.replace('/login'));
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  displayName: { color: colors.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  statBlock: { flex: 1, gap: 2 },
  stat: { color: colors.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  sectionLabel: { marginTop: 6 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  listCopy: { flex: 1, gap: 1 },
  listTitle: { color: colors.text, fontSize: 13, fontWeight: '600' },
  warnCopy: { color: colors.warning },
  manageWeb: { marginTop: 6, color: colors.primary },
});
