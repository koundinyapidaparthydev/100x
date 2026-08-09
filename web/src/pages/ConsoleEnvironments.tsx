import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@shared/api';
import { hasPlatformCapability } from '../lib/rbac';
import type { WorkspaceEnvironment } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import {
  commitActiveEnvironmentId,
  writeCachedActiveEnvironmentId,
} from '../lib/environmentStorage';
import { AsyncBoundary, Button, Card, Field, PageContainer, PageHeader, StatusBadge } from '../components/ui';

export default function ConsoleEnvironments() {
  const me = useAsync(() => api.me(), []);
  const canManage = hasPlatformCapability(me.data?.user, 'environments.manage');
  const [environments, setEnvironments] = useState<WorkspaceEnvironment[]>([]);
  const [activeEnvironmentId, setActiveEnvironmentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listEnvironments();
      setEnvironments(res.environments);
      setActiveEnvironmentId(res.activeEnvironmentId);
      writeCachedActiveEnvironmentId(res.activeEnvironmentId, { emit: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load environments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.createEnvironment({ name, key: key || name });
      setEnvironments(res.environments);
      setActiveEnvironmentId(res.activeEnvironmentId);
      setName('');
      setKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create environment');
    } finally {
      setBusy(false);
    }
  };

  const onSetActive = async (environmentId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.setActiveEnvironment({ environmentId });
      setEnvironments(res.environments);
      setActiveEnvironmentId(res.activeEnvironmentId);
      commitActiveEnvironmentId(res.activeEnvironmentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set active environment');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer width="form" data-testid="environments-page">
      <PageHeader
        eyebrow="Workspace"
        title="Environments"
        description="Production, Staging, Development, and custom levels. Switch from the header; create and manage them here."
        actions={
          <Link to="/admin" className="text-sm font-medium text-primary hover:underline">
            Security
          </Link>
        }
      />

      <AsyncBoundary loading={me.loading || loading} error={me.error ?? error} onRetry={() => void load()}>
        <Card title="Environment levels" description={`${environments.length} environment(s)`} data-testid="environments-panel">
          <ul className="divide-y divide-outline-variant" data-testid="environments-list">
            {environments.map((env) => {
              const active = env.id === activeEnvironmentId;
              return (
                <li key={env.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 font-medium text-on-surface">{env.name}</span>
                  <span className="font-mono text-xs text-on-surface-variant">{env.key}</span>
                  {active ? (
                    <StatusBadge status="active" tone="success" label="Active" />
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void onSetActive(env.id)}
                      data-testid={`env-set-active-${env.key}`}
                    >
                      Set active
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>

          {canManage && (
            <form
              className="mt-4 flex flex-col gap-3 border-t border-outline-variant pt-4 sm:flex-row sm:items-end"
              onSubmit={onCreate}
            >
              <Field
                label="Name"
                className="min-w-0 flex-1"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="QA"
                data-testid="env-name"
              />
              <Field
                label="Key"
                className="sm:w-40"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="qa"
                data-testid="env-key"
              />
              <Button type="submit" loading={busy} data-testid="env-create-submit">
                Add environment
              </Button>
            </form>
          )}
        </Card>
      </AsyncBoundary>
    </PageContainer>
  );
}
