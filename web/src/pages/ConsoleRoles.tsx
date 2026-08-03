import { api } from '@shared/api';
import { useAsync } from '../lib/useAsync';
import { AsyncBoundary, Card, PageContainer, PageHeader, StatusBadge } from '../components/ui';
import { roleDisplay } from '../lib/format';

export default function ConsoleRoles() {
  const { data, loading, error, reload } = useAsync(() => api.listIdentityRoles(), []);

  return (
    <PageContainer width="form">
      <PageHeader
        eyebrow="Identity"
        title="Roles"
        description="Built-in workspace roles. Custom role policies ship in a later phase."
      />
      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        <div className="grid gap-3">
          {(data?.roles ?? []).map((role) => (
            <Card key={role.id} hierarchy="secondary">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-on-surface">{roleDisplay(role.id)}</h2>
                  <p className="mt-1 text-sm text-on-surface-variant">{role.description}</p>
                </div>
                <StatusBadge status="info" label={role.builtIn ? 'Built-in' : 'Custom'} />
              </div>
            </Card>
          ))}
        </div>
      </AsyncBoundary>
    </PageContainer>
  );
}
