import { useState } from 'react';
import { Bell, ClipboardCheck, LogOut, Menu } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '@shared/api';
import { clearDemoSession, readDemoSession } from '../lib/session';
import { getProjectRouteContext } from '../lib/projectRoutes';
import { cn } from '../lib/utils';
import {
  ADMIN_ITEM,
  isNavItemActive,
  ORGANIZATION_ITEMS,
  projectNavItems,
  type NavItem,
} from './navItems';

function OrgLink({ item, withTestId }: { item: NavItem; withTestId: boolean }) {
  const location = useLocation();
  const active = isNavItemActive(location.pathname, item);
  return (
    <Link
      to={item.path}
      data-testid={withTestId ? item.testId : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors',
        active
          ? 'bg-primary-container text-on-primary-container'
          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
      )}
    >
      {item.name}
    </Link>
  );
}

function ProjectContextRow({ projectId, withTestId }: { projectId: string; withTestId: boolean }) {
  const location = useLocation();
  const items = projectNavItems(projectId);

  return (
    <div
      className="border-b border-outline-variant/80 bg-surface-container-low/80"
      data-testid="project-context-row"
    >
      <div className="flex items-center gap-2 overflow-x-auto px-3 py-2 sm:px-5">
        <span className="hidden shrink-0 text-xs font-semibold uppercase tracking-[0.06em] text-on-surface-variant sm:inline">
          {projectId}
        </span>
        <span className="hidden h-4 w-px shrink-0 bg-outline-variant sm:block" aria-hidden="true" />
        <nav aria-label="Project sections" className="flex min-w-0 items-center gap-1">
          {items.map((item) => {
            const active = isNavItemActive(location.pathname, item);
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={withTestId ? item.testId : undefined}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-8 shrink-0 items-center rounded-chip px-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-surface text-on-surface shadow-xs'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
                )}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export default function Topbar({
  onOpenNavigation,
  desktopNav = true,
}: {
  onOpenNavigation: () => void;
  /** When false, org/project test IDs live on the mobile drawer instead. */
  desktopNav?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const session = readDemoSession();
  const projectContext = getProjectRouteContext(location.pathname);
  const adminActive = isNavItemActive(location.pathname, ADMIN_ITEM);

  const logout = async () => {
    setBusy(true);
    try {
      await api.logout();
    } catch {
      /* client must clear even if network fails */
    } finally {
      clearDemoSession();
      setBusy(false);
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="sticky top-0 z-30">
      <header
        className="flex h-14 items-center justify-between gap-3 border-b border-outline-variant bg-surface/95 px-3 backdrop-blur-sm sm:px-5"
        data-testid="topbar"
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button
            type="button"
            aria-label="Open navigation"
            aria-controls="primary-navigation"
            onClick={onOpenNavigation}
            className="rounded-md p-2 text-on-surface-variant hover:bg-surface-container hover:text-on-surface md:hidden"
          >
            <Menu size={20} aria-hidden="true" />
          </button>

          <Link to="/projects" className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
              <ClipboardCheck size={16} aria-hidden="true" />
            </span>
            <span className="truncate text-sm font-semibold tracking-tight text-on-surface sm:text-base">
              AplifyAI
            </span>
          </Link>

          <nav
            aria-label="Organization"
            className="ml-1 hidden items-center gap-0.5 md:flex"
          >
            {ORGANIZATION_ITEMS.map((item) => (
              <OrgLink key={item.path} item={item} withTestId={desktopNav} />
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            to="/admin"
            data-testid={desktopNav ? ADMIN_ITEM.testId : undefined}
            aria-current={adminActive ? 'page' : undefined}
            className={cn(
              'hidden min-h-9 items-center rounded-lg px-2.5 text-sm font-medium md:inline-flex',
              adminActive
                ? 'bg-primary-container text-on-primary-container'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
            )}
          >
            Admin
          </Link>
          <Link
            to="/approvals"
            className="flex size-9 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            data-testid="nav-notifications"
            aria-label="View approvals"
            title="View approvals"
          >
            <Bell size={18} aria-hidden="true" />
          </Link>
          <div className="mx-0.5 hidden h-7 w-px bg-outline-variant sm:block" />
          <div
            className="flex items-center gap-2"
            title={session ? `${session.id} · ${session.role}` : 'Demo session'}
            data-testid="session-avatar"
            data-role={session?.role ?? ''}
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-primary-container text-xs font-semibold text-on-primary-container">
              {(session?.role ?? 'sj').slice(0, 2).toUpperCase()}
            </span>
            <span className="hidden max-w-32 lg:block">
              <span className="block truncate text-xs font-medium text-on-surface">{session?.id ?? 'Demo user'}</span>
              <span className="block text-[11px] capitalize text-on-surface-variant">{session?.role ?? 'session'}</span>
            </span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void logout()}
            className="ml-0.5 flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-on-surface-variant hover:bg-surface-container hover:text-on-surface disabled:opacity-50"
            data-testid="logout-button"
          >
            <LogOut size={14} />
            <span className="hidden xl:inline">{busy ? 'Signing out…' : 'Log out'}</span>
          </button>
        </div>
      </header>

      {projectContext && (
        <ProjectContextRow projectId={projectContext.projectId} withTestId={desktopNav} />
      )}
    </div>
  );
}
