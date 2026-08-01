import { Link, useLocation } from 'react-router-dom';
import { ClipboardCheck, X } from 'lucide-react';
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
  /** When true, this drawer owns nav-* test IDs (mobile). */
  ownTestIds?: boolean;
}

export default function Sidebar({ open = false, onClose, ownTestIds = false }: SidebarProps) {
  const location = useLocation();
  const projectContext = getProjectRouteContext(location.pathname);
  const projectItems = projectContext ? projectNavItems(projectContext.projectId) : [];

  const itemClass = (item: NavItem) => {
    const active = isNavItemActive(location.pathname, item);
    return cn(
      'group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      active
        ? 'bg-primary-container text-on-primary-container'
        : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
    );
  };

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
        <div className="mb-5 flex h-11 items-center gap-3 px-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-on-primary">
            <ClipboardCheck size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold tracking-tight text-on-surface">AplifyAI</p>
            <p className="truncate text-xs text-on-surface-variant">Work with clear guardrails</p>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="ml-auto rounded-md p-2 text-on-surface-variant hover:bg-surface-container"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto" data-testid="sidebar-navigation">
          {[
            { label: 'Organization', items: ORGANIZATION_ITEMS },
            ...(projectContext ? [{ label: projectContext.projectId, items: projectItems }] : []),
          ].map((group) => (
            <section
              key={group.label}
              aria-labelledby={`nav-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            >
              <h2
                id={`nav-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                className="mb-1 truncate px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant"
                title={group.label}
              >
                {group.label}
              </h2>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        data-testid={ownTestIds ? item.testId : undefined}
                        className={itemClass(item)}
                        onClick={onClose}
                      >
                        <Icon size={18} aria-hidden="true" />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>

        <div className="mt-4 border-t border-outline-variant pt-3">
          <Link
            to={ADMIN_ITEM.path}
            data-testid={ownTestIds ? ADMIN_ITEM.testId : undefined}
            className={itemClass(ADMIN_ITEM)}
            onClick={onClose}
          >
            <ADMIN_ITEM.icon size={18} aria-hidden="true" />
            {ADMIN_ITEM.name}
          </Link>
        </div>
      </aside>
    </>
  );
}
