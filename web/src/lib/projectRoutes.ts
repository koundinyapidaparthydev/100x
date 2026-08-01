export const projectRoutes = {
  projects: '/projects',
  project: (projectId: string) => `/projects/${encodeURIComponent(projectId)}`,
  work: (projectId: string) => `/projects/${encodeURIComponent(projectId)}/work`,
  workItem: (projectId: string, workItemId: string) =>
    `/projects/${encodeURIComponent(projectId)}/work/${encodeURIComponent(workItemId)}`,
  approvals: (projectId: string) => `/projects/${encodeURIComponent(projectId)}/approvals`,
  activity: (projectId: string) => `/projects/${encodeURIComponent(projectId)}/activity`,
} as const;

export type ProjectSection = 'overview' | 'work' | 'approvals' | 'activity';

export interface ProjectRouteContext {
  projectId: string;
  section: ProjectSection;
  workItemId?: string;
}

export function getProjectRouteContext(pathname: string): ProjectRouteContext | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'projects' || !segments[1]) return null;

  const projectId = decodeURIComponent(segments[1]);
  if (segments[2] === 'work') {
    return {
      projectId,
      section: 'work',
      workItemId: segments[3] ? decodeURIComponent(segments[3]) : undefined,
    };
  }
  if (segments[2] === 'approvals') return { projectId, section: 'approvals' };
  if (segments[2] === 'activity') return { projectId, section: 'activity' };
  return { projectId, section: 'overview' };
}
