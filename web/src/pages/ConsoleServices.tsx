import { Link } from 'react-router-dom';
import { api } from '@shared/api';
import { useAsync } from '../lib/useAsync';
import {
  AsyncBoundary,
  Card,
  PageContainer,
  PageHeader,
  ResponsiveDataList,
  StatusBadge,
} from '../components/ui';
import { humanize } from '../lib/format';

export default function ConsoleServices() {
  const { data, loading, error, reload } = useAsync(() => api.listConsoleServices(), []);

  return (
    <PageContainer width="operational">
      <PageHeader
        eyebrow="Catalog"
        title="Services"
        description="Platforms available through the MCP catalog. Connect them from Connections."
        actions={
          <Link to="/connections" className="text-sm font-medium text-primary hover:underline">
            Open Connections
          </Link>
        }
      />
      <AsyncBoundary loading={loading} error={error} onRetry={reload}>
        <Card title="Service catalog" description={`${data?.services.length ?? 0} service(s)`}>
          <ResponsiveDataList
            items={data?.services ?? []}
            getKey={(s) => s.id}
            caption="Console services"
            columns={[
              { key: 'name', label: 'Service', render: (s) => s.name },
              { key: 'category', label: 'Category', render: (s) => humanize(s.category) },
              {
                key: 'status',
                label: 'Status',
                render: (s) => (
                  <StatusBadge
                    status={s.connected ? 'success' : 'neutral'}
                    label={s.connected ? 'Connected' : 'Not connected'}
                  />
                ),
              },
              {
                key: 'permission',
                label: 'Permission',
                render: (s) => (s.permissionLevel ? humanize(s.permissionLevel) : '—'),
              },
            ]}
          />
        </Card>
      </AsyncBoundary>
    </PageContainer>
  );
}
