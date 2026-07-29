import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Activity,
  CheckSquare,
  ShieldAlert,
  ArrowLeft,
  Bell,
} from 'lucide-react';
import { cn } from '../lib/utils';

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine header properties based on route
  const getHeaderProps = () => {
    const path = location.pathname;

    if (path.includes('/ticket/')) {
      return {
        title: 'Ticket',
        showBack: true,
      };
    }

    if (path === '/app/notifications') {
      return {
        title: 'Notifications',
        showBack: true,
      };
    }

    // Default header
    return {
      title: 'OffshoreHelper',
      showBack: false,
      rightAction: (
        <button
          onClick={() => navigate('/app/notifications')}
          aria-label="Notifications"
          className="relative text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-colors"
        >
          <Bell className="w-5 h-5" />
        </button>
      ),
    };
  };

  const headerProps = getHeaderProps();
  const hideBottomNav =
    location.pathname.includes('/ticket/') || location.pathname === '/app/notifications';

  return (
    <div className="flex flex-col h-full bg-background text-on-surface">
      {/* Top App Bar */}
      <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-4 h-14 bg-surface-container-lowest border-b border-outline-variant">
        <div className="flex items-center gap-3">
          {headerProps.showBack ? (
            <button
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="p-1 -ml-1 text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          ) : (
            <div className="p-1 -ml-1 text-primary">
              <ClipboardList className="w-6 h-6" />
            </div>
          )}
          <span className="font-sans font-semibold text-xl text-primary tracking-tight">
            {headerProps.title}
          </span>
        </div>

        <div className="flex items-center gap-2">{headerProps.rightAction}</div>
      </header>

      {/* Main Content Area */}
      <main
        className={cn('flex-1 overflow-y-auto no-scrollbar pt-14', !hideBottomNav && 'pb-16')}
      >
        <Outlet />
      </main>

      {/* Bottom Nav Bar */}
      {!hideBottomNav && (
        <nav className="fixed bottom-0 left-0 w-full z-50 flex items-center justify-around h-16 bg-surface-container-lowest border-t border-outline-variant pb-safe">
          <NavButton
            icon={<ClipboardList />}
            label="Triage"
            isActive={location.pathname === '/app/triage'}
            onClick={() => navigate('/app/triage')}
          />
          <NavButton
            icon={<Activity />}
            label="Jobs"
            isActive={location.pathname === '/app/jobs'}
            onClick={() => navigate('/app/jobs')}
          />
          <NavButton
            icon={<CheckSquare />}
            label="Approvals"
            isActive={location.pathname === '/app/approvals'}
            onClick={() => navigate('/app/approvals')}
          />
          <NavButton
            icon={<ShieldAlert />}
            label="PII"
            isActive={location.pathname === '/app/pii'}
            onClick={() => navigate('/app/pii')}
          />
        </nav>
      )}
    </div>
  );
}

function NavButton({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center w-full h-full transition-colors',
        isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container-low',
      )}
    >
      <div className="mb-1 [&>svg]:w-6 [&>svg]:h-6">{icon}</div>
      <span className="font-mono text-[10px] uppercase tracking-wider">{label}</span>
    </button>
  );
}
