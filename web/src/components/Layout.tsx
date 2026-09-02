import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import CommandPalette from './CommandPalette';

function useDesktopNav() {
  const [desktopNav, setDesktopNav] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true,
  );

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const sync = () => setDesktopNav(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return desktopNav;
}

export default function Layout() {
  const location = useLocation();
  const desktopNav = useDesktopNav();
  const [navigationOpen, setNavigationOpen] = useState(false);

  useEffect(() => {
    setNavigationOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navigationOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavigationOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [navigationOpen]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-on-background">
      <div
        className="border-b border-butter/30 bg-butter-container px-4 py-2 text-center text-sm text-on-butter-container"
        data-testid="sandbox-demo-banner"
        role="status"
      >
        Sandbox demo — no live Jira
      </div>
      <Topbar
        onOpenNavigation={() => setNavigationOpen(true)}
        desktopNav={desktopNav}
      />
      <div className="flex min-h-0 min-w-0 flex-1">
        <Sidebar
          open={navigationOpen}
          onClose={() => setNavigationOpen(false)}
          ownTestIds={!desktopNav}
          desktopRail={desktopNav}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
