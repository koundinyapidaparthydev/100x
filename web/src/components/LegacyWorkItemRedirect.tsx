import { Navigate, useLocation, useParams } from 'react-router-dom';
import { api } from '@shared/api';
import { useAsync } from '../lib/useAsync';
import { projectRoutes } from '../lib/projectRoutes';
import { ErrorState, LoadingState } from './AsyncStates';
import { PageContainer } from './ui';

export default function LegacyWorkItemRedirect() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const result = useAsync(() => api.getWorkItem(id!), [id]);

  if (result.loading) {
    return <PageContainer><LoadingState label="Opening work item…" /></PageContainer>;
  }
  if (result.error || !result.data) {
    return <PageContainer><ErrorState message={result.error ?? 'Work item not found'} onRetry={result.reload} /></PageContainer>;
  }

  return (
    <Navigate
      replace
      to={`${projectRoutes.workItem(result.data.board.projectId, result.data.id)}${location.search}${location.hash}`}
    />
  );
}
