import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

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
      <Topbar
        onOpenNavigation={() => setNavigationOpen(true)}
        desktopNav={desktopNav}
      />
      <Sidebar
        open={navigationOpen}
        onClose={() => setNavigationOpen(false)}
        ownTestIds={!desktopNav}
      />
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
