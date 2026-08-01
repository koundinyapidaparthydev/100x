import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '@shared/api';
import type { BoardHealth, WorkItem } from '@shared/types';
import { useAsync } from '../lib/useAsync';
import { AsyncBoundary, PageContainer, PageHeader } from '../components/ui';
import { WorkItemList, WorkQueueFilters } from '../components/work';
import {
  findBoard,
  matchesWorkFilter,
  parseWorkQueueFilter,
  type WorkQueueFilter,
  WORK_QUEUE_FILTERS,
} from '../lib/workQueue';
import { projectRoutes } from '../lib/projectRoutes';
import { Link } from 'react-router-dom';

async function loadProjectWork(projectId: string): Promise<{ board?: BoardHealth; workItems: WorkItem[] }> {
  const [boards, workItems] = await Promise.all([api.listBoards(), api.listWorkItems({ projectId })]);
  return { board: findBoard(boards, projectId), workItems };
}

export default function ProjectWork() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const filter = parseWorkQueueFilter(searchParams.get('filter'));
  const { data, loading, error, reload } = useAsync(() => loadProjectWork(projectId), [projectId]);

  const filtered = useMemo(
    () => (data?.workItems ?? []).filter((item) => matchesWorkFilter(item, filter)),
    [data, filter],
  );

  const counts = useMemo(() => {
    const items = data?.workItems ?? [];
    const result = {} as Partial<Record<WorkQueueFilter, number>>;
    for (const f of WORK_QUEUE_FILTERS) {
      result[f.id] = items.filter((item) => matchesWorkFilter(item, f.id)).length;
    }
    return result;
  }, [data]);

  const title = data?.board?.name ?? projectId;

  return (
    <PageContainer className="flex flex-col gap-6" data-testid="project-work-page">
      <PageHeader
        eyebrow={
          <Link to={projectRoutes.project(projectId)} className="hover:text-on-surface">
            {title}
          </Link>
        }
        title="Work"
        description="URL-backed filters for attention, triage, running jobs, review, blocks, and human-assigned work."
      />

      <WorkQueueFilters projectId={projectId} active={filter} counts={counts} />

      <AsyncBoundary
        loading={loading}
        error={error}
        empty={!loading && !error && filtered.length === 0}
        loadingLabel="Loading work items…"
        emptyTitle={data?.workItems.length ? 'No matching work items' : 'No work items'}
        emptyBody={
          data?.workItems.length
            ? 'Try another filter or clear the current one.'
            : 'Sync this project to pull issues into AplifyAI.'
        }
        onRetry={reload}
      >
        <WorkItemList items={filtered} filter={filter} />
      </AsyncBoundary>
    </PageContainer>
  );
}
