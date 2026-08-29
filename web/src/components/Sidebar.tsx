import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import EnvironmentSwitcher from './EnvironmentSwitcher';
import { CONSOLE_CONTEXT_ITEMS } from '../lib/consoleNav';
import { getProjectRouteContext } from '../lib/projectRoutes';
import { cn } from '../lib/utils';
import {
  ADMIN_ITEM,
  isNavItemActive,
  ORGANIZATION_ITEMS,
  projectNavItems,
  type NavItem,
} from './navItems';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  /** When true, the mobile drawer owns nav-* test IDs. */
  ownTestIds?: boolean;
  /** Render the persistent desktop left rail. */
  desktopRail?: boolean;
}

function isConsolePath(pathname: string): boolean {
  return pathname === '/console' || pathname.startsWith('/console/');
}

function isConsoleItemActive(pathname: string, path: string, exact?: boolean): boolean {
  if (exact) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

function NavBody({
  withTestIds,
  showDrawerChrome,
  drawerOpen = false,
  onClose,
}: {
  withTestIds: boolean;
  showDrawerChrome: boolean;
  /** When true, mount the drawer EnvironmentSwitcher (avoid dual Topbar+drawer writers). */
  drawerOpen?: boolean;
  onClose?: () => void;
}) {
  const location = useLocation();
  const projectContext = getProjectRouteContext(location.pathname);
  const projectItems = projectContext ? projectNavItems(projectContext.projectId) : [];
  const consoleActive = isConsolePath(location.pathname);
  const [consoleOpen, setConsoleOpen] = useState(consoleActive);

  useEffect(() => {
    if (consoleActive) setConsoleOpen(true);
  }, [consoleActive]);

  // Project links stay in the topbar context row on desktop.
  const showProjectGroup = Boolean(projectContext) && showDrawerChrome;

  const itemClass = (active: boolean) =>
    cn(
      'group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      active
        ? 'bg-primary-container text-on-primary-container'
        : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
    );

  const renderOrgLink = (item: NavItem): ReactNode => {
    const Icon = item.icon;
    const active = isNavItemActive(location.pathname, item);
    return (
      <li key={item.path}>
        <Link
          to={item.path}
          data-testid={withTestIds ? item.testId : undefined}
          className={itemClass(active)}
          onClick={onClose}
          aria-current={active ? 'page' : undefined}
        >
          <Icon size={18} aria-hidden="true" />
          {item.name}
        </Link>
      </li>
    );
  };

  return (
    <>
      {showDrawerChrome && (
        <>
          <div className="mb-4 flex h-11 items-center gap-3 px-2">
            <BrandLogo size={36} withWordmark wordmarkClassName="text-base" />
            <button
              type="button"
              aria-label="Close navigation"
              onClick={onClose}
              className="ml-auto rounded-md p-2 text-on-surface-variant hover:bg-surface-container"
            >
              <X size={18} />
            </button>
          </div>

          {/* Mount only while the drawer is open — Topbar owns desktop env switching. */}
          {drawerOpen ? (
            <div className="mb-4 px-1">
              <EnvironmentSwitcher variant="drawer" onNavigated={onClose} />
            </div>
          ) : null}
        </>
      )}

      {!showDrawerChrome && (
        <div className="mb-3 px-2 pt-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            Workspace
          </p>
        </div>
      )}

      <nav
        className="min-h-0 flex-1 space-y-5 overflow-y-auto"
        data-testid={withTestIds ? 'sidebar-navigation' : undefined}
      >
        <section aria-labelledby="nav-organization">
          <h2
            id="nav-organization"
            className="mb-1 truncate px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant"
          >
            Organization
          </h2>
          <ul className="space-y-0.5">
            {ORGANIZATION_ITEMS.map((item) => {
              if (item.path === '/console') {
                return (
                  <li key={item.path}>
                    <button
                      type="button"
                      data-testid={withTestIds ? item.testId : undefined}
                      aria-expanded={consoleOpen}
                      aria-controls="console-nav-group"
                      onClick={() => setConsoleOpen((v) => !v)}
                      className={cn(itemClass(consoleActive), 'w-full')}
                    >
                      <item.icon size={18} aria-hidden="true" />
                      <span className="flex-1 text-left">{item.name}</span>
                      <ChevronDown
                        size={16}
                        className={cn(
                          'shrink-0 opacity-70 transition-transform',
                          consoleOpen && 'rotate-180',
                        )}
                        aria-hidden="true"
                      />
                    </button>
                    {consoleOpen && (
                      <ul
                        id="console-nav-group"
                        className="ml-4 mt-0.5 space-y-0.5 border-l border-outline-variant pl-2"
                        data-testid={withTestIds ? 'console-nav-group' : undefined}
                      >
                        {CONSOLE_CONTEXT_ITEMS.map((consoleItem) => {
                          const active = isConsoleItemActive(
                            location.pathname,
                            consoleItem.path,
                            consoleItem.exact,
                          );
                          return (
                            <li key={consoleItem.path}>
                              <Link
                                to={consoleItem.path}
                                data-testid={withTestIds ? consoleItem.testId : undefined}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                  'flex min-h-9 items-center rounded-lg px-3 py-1.5 text-sm transition-colors',
                                  active
                                    ? 'bg-surface font-semibold text-on-surface shadow-xs'
                                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
                                )}
                                onClick={onClose}
                              >
                                {consoleItem.name}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              }
              return renderOrgLink(item);
            })}
          </ul>
        </section>

        {showProjectGroup && (
          <section
            aria-labelledby={`nav-project-${projectContext!.projectId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
          >
            <h2
              id={`nav-project-${projectContext!.projectId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              className="mb-1 truncate px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant"
              title={projectContext!.projectId}
            >
              {projectContext!.projectId}
            </h2>
            <ul className="space-y-0.5">
              {projectItems.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(location.pathname, item);
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      data-testid={withTestIds ? item.testId : undefined}
                      className={itemClass(active)}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon size={18} aria-hidden="true" />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </nav>

      {/* Security lives in the topbar on desktop; keep it in the mobile drawer footer. */}
      {showDrawerChrome && (
        <div className="mt-4 border-t border-outline-variant pt-3">
          <Link
            to={ADMIN_ITEM.path}
            data-testid={withTestIds ? ADMIN_ITEM.testId : undefined}
            className={itemClass(isNavItemActive(location.pathname, ADMIN_ITEM))}
            onClick={onClose}
          >
            <ADMIN_ITEM.icon size={18} aria-hidden="true" />
            {ADMIN_ITEM.name}
          </Link>
        </div>
      )}
    </>
  );
}

export default function Sidebar({
  open = false,
  onClose,
  ownTestIds = false,
  desktopRail = false,
}: SidebarProps) {
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-on-background/25 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        id="primary-navigation"
        aria-label="Primary navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-outline-variant bg-surface px-3 py-4 transition-transform duration-200 md:hidden',
          open ? 'visible translate-x-0 shadow-xl' : 'invisible -translate-x-full',
        )}
      >
        <NavBody
          withTestIds={ownTestIds}
          showDrawerChrome
          drawerOpen={open}
          onClose={onClose}
        />
      </aside>

      {desktopRail && (
        <aside
          aria-label="Workspace navigation"
          data-testid="desktop-sidebar"
          className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-outline-variant bg-surface px-3 py-4 md:flex"
        >
          <NavBody withTestIds={!ownTestIds} showDrawerChrome={false} />
        </aside>
      )}
    </>
  );
}
