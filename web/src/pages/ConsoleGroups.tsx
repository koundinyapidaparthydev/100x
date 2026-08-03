import { FormEvent, useEffect, useState } from 'react';
import { api } from '@shared/api';
import type { IdentityGroup, UserRole } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import {
  AsyncBoundary,
  Button,
  Card,
  Field,
  PageContainer,
  PageHeader,
  ResponsiveDataList,
} from '../components/ui';
import { roleDisplay } from '../lib/format';

export default function ConsoleGroups() {
  const me = useAsync(() => api.me(), []);
  const canManage = me.data?.user.role === 'root' || me.data?.user.role === 'manager';
  const [groups, setGroups] = useState<IdentityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listIdentityGroups();
      setGroups(res.groups);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load groups');
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
    try {
      await api.createIdentityGroup({ name, description });
      setName('');
      setDescription('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!me.data || me.data.user.role !== 'root') return;
    setBusy(true);
    try {
      await api.deleteIdentityGroup(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer width="operational">
      <PageHeader eyebrow="Identity" title="Groups" description="Attach members and roles to named groups." />
      <AsyncBoundary loading={me.loading || loading} error={me.error ?? error} onRetry={() => void load()}>
        <div className="space-y-6">
          {canManage && (
            <Card title="Create group">
              <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field label="Name">
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 text-sm"
                    data-testid="console-group-name"
                  />
                </Field>
                <Field label="Description">
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 text-sm"
                  />
                </Field>
                <Button type="submit" loading={busy} data-testid="console-group-create">
                  Create
                </Button>
              </form>
            </Card>
          )}

          <Card title="Groups" description={`${groups.length} group(s)`}>
            <ResponsiveDataList
              items={groups}
              getKey={(g) => g.id}
              caption="Identity groups"
              columns={[
                { key: 'name', label: 'Name', render: (g) => g.name },
                { key: 'description', label: 'Description', render: (g) => g.description || '—' },
                {
                  key: 'roles',
                  label: 'Roles',
                  render: (g) =>
                    g.roleIds.length
                      ? g.roleIds.map((r: UserRole) => roleDisplay(r)).join(', ')
                      : '—',
                },
                {
                  key: 'members',
                  label: 'Members',
                  render: (g) => String(g.memberIds.length),
                },
                {
                  key: 'actions',
                  label: '',
                  render: (g) =>
                    me.data?.user.role === 'root' ? (
                      <Button variant="danger" onClick={() => void onDelete(g.id)} disabled={busy}>
                        Delete
                      </Button>
                    ) : (
                      '—'
                    ),
                },
              ]}
            />
          </Card>
        </div>
      </AsyncBoundary>
    </PageContainer>
  );
}
