import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, ClipboardCheck, LogOut, Menu, Search, Settings } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@shared/api';
import type { AuthUser } from '@shared/types';
import { clearDemoSession, readDemoSession, writeDemoSession } from '../lib/session';
import { getProjectRouteContext } from '../lib/projectRoutes';
import { isDemoSeatSession, roleDisplay } from '../lib/format';
import { cn } from '../lib/utils';
import {
  ADMIN_ITEM,
  isNavItemActive,
  ORGANIZATION_ITEMS,
  projectNavItems,
  type NavItem,
} from './navItems';

const DEMO_SEATS: { id: string; label: string; hint: string }[] = [
  { id: 'root', label: 'Root', hint: 'Org owner — policies, invites, full access' },
  { id: 'manager', label: 'Delivery lead', hint: 'Triage & approvals' },
  { id: 'engineer', label: 'Contributor', hint: 'Read-only' },
  { id: 'auditor', label: 'Auditor', hint: 'Approvals visibility' },
];

function OrgLink({ item, withTestId }: { item: NavItem; withTestId: boolean }) {
  const location = useLocation();
  const active = isNavItemActive(location.pathname, item);
  return (
    <Link
      to={item.path}
      data-testid={withTestId ? item.testId : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex min-h-9 items-center rounded-md px-2.5 text-sm font-medium transition-colors',
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
      <div className="mx-auto flex max-w-[1400px] items-center gap-2 overflow-x-auto px-3 py-2 sm:px-5">
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

function initialsFrom(user: AuthUser | null, fallbackId: string): string {
  const source = user?.displayName || user?.email || fallbackId;
  const parts = source.replace(/^[^a-zA-Z0-9]+/, '').split(/[\s@:_-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  return source.slice(0, 2).toUpperCase() || '??';
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
  const [searchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [seatOpen, setSeatOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [me, setMe] = useState<AuthUser | null>(null);
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const seatMenuRef = useRef<HTMLDivElement>(null);
  const session = readDemoSession();
  const projectContext = getProjectRouteContext(location.pathname);
  const settingsActive = isNavItemActive(location.pathname, ADMIN_ITEM);
  const canSwitchDemoSeat = isDemoSeatSession(session?.id);

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
  }, [searchParams]);

  useEffect(() => {
    if (!session) {
      setMe(null);
      return;
    }
    let cancelled = false;
    void api
      .me()
      .then((res) => {
        if (!cancelled) setMe(res.user);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.token, session?.id]);

  useEffect(() => {
    if (!seatOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!seatMenuRef.current?.contains(event.target as Node)) {
        setSeatOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSeatOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [seatOpen]);

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

  const switchDemoSeat = async (identity: string) => {
    if (!session || session.role === identity || switching) return;
    setSwitching(true);
    setSeatOpen(false);
    try {
      const { session: next } = await api.login({ identity, surface: 'web' });
      writeDemoSession({
        token: next.token,
        id: next.user.id,
        role: next.user.role,
        surface: 'web',
      });
      window.location.reload();
    } catch {
      setSwitching(false);
    }
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    const next = q ? `/projects?q=${encodeURIComponent(q)}` : '/projects';
    navigate(next);
  };

  const displayName = me?.displayName || me?.email || session?.id || 'Signed in';
  const displayRole = roleDisplay(me?.role ?? session?.role ?? '');
  const subtitle = canSwitchDemoSeat ? `${displayRole} · Demo` : displayRole;

  return (
    <div className="sticky top-0 z-30">
      <header className="border-b border-outline-variant bg-surface/95 backdrop-blur-sm" data-testid="topbar">
        <div className="mx-auto grid h-14 max-w-[1400px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 sm:gap-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              aria-controls="primary-navigation"
              onClick={onOpenNavigation}
              className="rounded-md p-2 text-on-surface-variant hover:bg-surface-container hover:text-on-surface md:hidden"
            >
              <Menu size={20} aria-hidden="true" />
            </button>

            <Link to="/projects" className="flex min-w-0 items-center gap-2.5" aria-label="AplifyAI home">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
                <ClipboardCheck size={16} aria-hidden="true" />
              </span>
              <span className="hidden truncate text-sm font-semibold tracking-tight text-on-surface sm:inline sm:text-base">
                AplifyAI
              </span>
            </Link>

            <nav aria-label="Organization" className="hidden items-center gap-0.5 md:flex">
              {ORGANIZATION_ITEMS.map((item) => (
                <OrgLink key={item.path} item={item} withTestId={desktopNav} />
              ))}
            </nav>
          </div>

          <form
            onSubmit={submitSearch}
            className="mx-auto hidden w-full max-w-xl md:block"
            role="search"
            data-testid="global-search"
          >
            <label className="relative block">
              <span className="sr-only">Search projects and connections</span>
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects…"
                data-testid="global-search-input"
                className="h-9 w-full rounded-lg border border-outline-variant bg-surface-container-low pl-9 pr-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </form>

          <div className="flex shrink-0 items-center justify-end gap-0.5 sm:gap-1">
            <Link
              to="/admin"
              data-testid={desktopNav ? ADMIN_ITEM.testId : undefined}
              aria-current={settingsActive ? 'page' : undefined}
              title="Workspace settings"
              className={cn(
                'hidden min-h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium md:inline-flex',
                settingsActive
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
              )}
            >
              <Settings size={16} aria-hidden="true" />
              <span>Settings</span>
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
            <div className="relative" ref={seatMenuRef}>
              <button
                type="button"
                disabled={!session || switching}
                onClick={() => {
                  if (canSwitchDemoSeat) setSeatOpen((open) => !open);
                }}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors',
                  canSwitchDemoSeat ? 'hover:bg-surface-container cursor-pointer' : 'cursor-default',
                )}
                title={canSwitchDemoSeat ? `${displayName} — switch demo seat` : displayName}
                data-testid="session-avatar"
                data-role={session?.role ?? ''}
                aria-haspopup={canSwitchDemoSeat ? 'menu' : undefined}
                aria-expanded={canSwitchDemoSeat ? seatOpen : undefined}
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-primary-container text-xs font-semibold text-on-primary-container">
                  {initialsFrom(me, session?.id ?? '??')}
                </span>
                <span className="hidden min-w-0 max-w-[10rem] xl:block">
                  <span className="block truncate text-xs font-medium text-on-surface">{displayName}</span>
                  <span className="block truncate text-[11px] text-on-surface-variant">
                    {switching ? 'Switching…' : subtitle}
                  </span>
                </span>
                {canSwitchDemoSeat && (
                  <ChevronDown size={14} className="hidden text-on-surface-variant sm:block" aria-hidden="true" />
                )}
              </button>
              {seatOpen && canSwitchDemoSeat && (
                <div
                  role="menu"
                  data-testid="demo-seat-menu"
                  className="absolute right-0 top-full z-40 mt-1 w-64 rounded-xl border border-outline-variant bg-surface p-1.5 shadow-md"
                >
                  <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-on-surface-variant">
                    Switch demo seat
                  </p>
                  {DEMO_SEATS.map((seat) => {
                    const active = session?.role === seat.id;
                    return (
                      <button
                        key={seat.id}
                        type="button"
                        role="menuitem"
                        data-testid={`demo-seat-${seat.id}`}
                        disabled={active || switching}
                        onClick={() => void switchDemoSeat(seat.id)}
                        className={cn(
                          'flex w-full flex-col rounded-lg px-2.5 py-2 text-left transition-colors',
                          active
                            ? 'bg-primary-container/70 text-on-primary-container'
                            : 'hover:bg-surface-container',
                        )}
                      >
                        <span className="text-sm font-semibold text-on-surface">{seat.label}</span>
                        <span className="text-xs text-on-surface-variant">{seat.hint}</span>
                      </button>
                    );
                  })}
                </div>
              )}
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
        </div>
      </header>

      {projectContext && (
        <ProjectContextRow projectId={projectContext.projectId} withTestId={desktopNav} />
      )}

      <form
        onSubmit={submitSearch}
        className="border-b border-outline-variant bg-surface px-3 py-2 md:hidden"
        role="search"
        data-testid="global-search-mobile"
      >
        <label className="relative block">
          <span className="sr-only">Search projects</span>
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            className="h-9 w-full rounded-lg border border-outline-variant bg-surface-container-low pl-9 pr-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
      </form>
    </div>
  );
}
