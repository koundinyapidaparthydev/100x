import {
  Activity,
  CheckSquare,
  FileCheck,
  FolderKanban,
  History,
  Home,
  LayoutGrid,
  Link2,
  ListTodo,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { projectRoutes } from '../lib/projectRoutes';

export type NavItem = {
  name: string;
  path: string;
  icon: LucideIcon;
  testId: string;
  exact?: boolean;
};

export const ORGANIZATION_ITEMS: NavItem[] = [
  { name: 'Home', path: '/home', icon: Home, testId: 'nav-home', exact: true },
  { name: 'Console', path: '/console', icon: LayoutGrid, testId: 'nav-console' },
  { name: 'Projects', path: '/projects', icon: FolderKanban, testId: 'nav-projects', exact: true },
  { name: 'Connections', path: '/connections', icon: Link2, testId: 'nav-connections' },
  { name: 'Approvals', path: '/approvals', icon: CheckSquare, testId: 'nav-approvals' },
  { name: 'Governance', path: '/governance/defaults', icon: FileCheck, testId: 'nav-governance' },
  { name: 'Audit', path: '/audit', icon: History, testId: 'nav-audit' },
];

export const ADMIN_ITEM: NavItem = {
  name: 'Security',
  path: '/admin',
  icon: ShieldCheck,
  testId: 'nav-admin',
};

export function projectNavItems(projectId: string): NavItem[] {
  return [
    { name: 'Overview', path: projectRoutes.project(projectId), icon: LayoutGrid, testId: 'nav-project-overview', exact: true },
    { name: 'Work', path: projectRoutes.work(projectId), icon: ListTodo, testId: 'nav-project-work' },
    { name: 'Approvals', path: projectRoutes.approvals(projectId), icon: CheckSquare, testId: 'nav-project-approvals' },
    { name: 'Activity', path: projectRoutes.activity(projectId), icon: Activity, testId: 'nav-project-activity' },
  ];
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.path;
  if (item.path === '/governance/defaults') return pathname.startsWith('/governance/');
  return pathname.startsWith(item.path);
}
