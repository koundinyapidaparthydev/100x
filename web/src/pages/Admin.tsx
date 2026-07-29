import { Compass, Key, ScrollText, Shield, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api';
import { useAsync } from '../lib/useAsync';
import { ErrorState, LoadingState } from '../components/AsyncStates';
import Chip from '../components/Chip';
import { formatNumber, humanize } from '../lib/format';

export default function Admin() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [policies, boards, approvals, auditEvents] = await Promise.all([
      api.listPolicies(),
      api.listBoards(),
      api.listApprovals(),
      api.listAuditEvents(),
    ]);
    return {
      tenantId: policies[0]?.tenantId ?? 'acme',
      policyCount: policies.length,
      boards,
      pendingApprovals: approvals.filter((a) => a.status === 'pending').length,
      auditCount: auditEvents.length,
    };
  }, []);

  return (
    <div className="max-w-container-max mx-auto p-margin flex flex-col gap-xl" data-testid="admin-page">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-headline-lg text-headline-lg font-semibold text-on-surface">System Administration</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-sm max-w-2xl">
            Manage users, access controls, and platform-wide configurations.
          </p>
        </div>
        <Chip tone="warning">Demo mode — real SSO/vault in H1</Chip>
      </div>

      {loading && <LoadingState label="Loading admin summary…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg">
            <div className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-sm">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Tenant</span>
              <span className="font-headline-sm text-headline-sm text-on-surface font-mono">{data.tenantId}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">Sandbox org (H0)</span>
            </div>
            <Link
              to="/policies"
              className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-sm hover:border-tertiary/50 transition-colors"
            >
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-xs">
                <ShieldCheck size={14} /> Policies
              </span>
              <span className="font-headline-md text-headline-md text-on-surface">{formatNumber(data.policyCount)}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">Org policy count</span>
            </Link>
            <div
              className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-sm"
              data-testid="admin-pending-approvals"
            >
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Pending approvals</span>
              <span className="font-headline-md text-headline-md text-on-surface">{formatNumber(data.pendingApprovals)}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">Awaiting manager decision</span>
            </div>
            <Link
              to="/audit-log"
              className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-sm hover:border-tertiary/50 transition-colors"
            >
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-xs">
                <ScrollText size={14} /> Audit events
              </span>
              <span className="font-headline-md text-headline-md text-on-surface">{formatNumber(data.auditCount)}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">Immutable log entries</span>
            </Link>
          </div>

          <div className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-md">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface flex items-center gap-sm">
                <Compass size={18} className="text-tertiary" /> Connected boards
              </h3>
              <Link to="/boards" className="font-label-md text-label-md text-tertiary hover:underline">
                Manage boards
              </Link>
            </div>
            {data.boards.length === 0 ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant">No boards connected yet.</p>
            ) : (
              <ul className="flex flex-col gap-sm">
                {data.boards.map((board) => (
                  <li
                    key={board.projectId}
                    className="flex items-center justify-between gap-md p-sm rounded bg-surface-variant/40 border border-outline-variant/40"
                  >
                    <div>
                      <span className="font-body-sm text-body-sm text-on-surface block">{board.name}</span>
                      <span className="font-mono text-label-sm text-on-surface-variant">{board.projectId}</span>
                    </div>
                    <Chip tone={board.state === 'healthy' ? 'tertiary' : board.state === 'error' ? 'error' : 'surface'}>
                      {humanize(board.state)}
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
        <div className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-md opacity-90">
          <div className="w-12 h-12 rounded bg-surface-variant flex items-center justify-center border border-outline-variant">
            <Users className="text-on-surface" size={24} />
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">User Management</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Manage team members, roles, and SSO mappings.
          </p>
          <Chip tone="warning" className="self-start">
            Demo mode — real SSO/vault in H1
          </Chip>
        </div>

        <div className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-md opacity-90">
          <div className="w-12 h-12 rounded bg-surface-variant flex items-center justify-center border border-outline-variant">
            <Shield className="text-on-surface" size={24} />
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Access Controls (RBAC)</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Define granular permissions for projects and policies.
          </p>
          <Chip tone="warning" className="self-start">
            Demo mode — real SSO/vault in H1
          </Chip>
        </div>

        <div className="bg-surface-container border border-outline-variant rounded-xl p-lg flex flex-col gap-md opacity-90">
          <div className="w-12 h-12 rounded bg-surface-variant flex items-center justify-center border border-outline-variant">
            <Key className="text-on-surface" size={24} />
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Integration Secrets</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Manage credentials for Jira, Azure, and external APIs.
          </p>
          <Chip tone="warning" className="self-start">
            Demo mode — real SSO/vault in H1
          </Chip>
        </div>
      </div>
    </div>
  );
}
