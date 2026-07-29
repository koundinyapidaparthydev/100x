import { useState } from 'react';
import { Search, Lock, Bell, Settings, Menu, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@shared/api';
import { clearDemoSession, readDemoSession } from '../lib/session';

export default function Topbar() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const session = readDemoSession();

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
    <header
      className="bg-surface-container/90 backdrop-blur-md border-b border-outline-variant flex justify-between items-center h-16 px-xl sticky top-0 z-30"
      data-testid="topbar"
    >
      <div className="flex items-center gap-md md:hidden">
        <button className="p-sm rounded-full hover:bg-surface-variant transition-colors text-on-surface-variant">
          <Menu size={20} />
        </button>
        <span className="font-headline-md text-headline-md font-semibold text-on-surface">AplifyAI</span>
      </div>
      <div className="hidden md:flex flex-1 max-w-md">
        <div className="relative flex items-center w-full h-10 rounded-full bg-surface-variant focus-within:ring-1 focus-within:ring-tertiary transition-shadow">
          <Search size={18} className="text-on-surface-variant absolute left-3" />
          <input
            type="text"
            placeholder="Search logs, policies, models..."
            className="w-full h-full bg-transparent border-none focus:ring-0 text-body-sm text-on-surface pl-10 pr-md rounded-full placeholder:text-on-surface-variant/50 focus:outline-none"
            data-testid="topbar-search"
          />
        </div>
      </div>
      <div className="flex items-center gap-sm">
        <Link
          to="/approvals"
          className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors relative group"
          data-testid="nav-notifications"
          title="Approvals & alerts"
        >
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-tertiary"></span>
        </Link>
        <button
          type="button"
          className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors relative group"
          title="Session locked"
        >
          <Lock size={20} className="group-hover:text-tertiary transition-colors" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-tertiary"></span>
        </button>
        <Link
          to="/admin"
          className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors"
          data-testid="nav-admin-settings"
        >
          <Settings size={20} />
        </Link>
        <div className="h-8 w-px bg-outline-variant mx-sm hidden sm:block"></div>
        <div
          className="w-8 h-8 rounded-full bg-tertiary/15 border border-tertiary/40 flex items-center justify-center"
          title={session?.role ?? 'Session'}
          data-testid="session-avatar"
          data-role={session?.role ?? ''}
        >
          <span className="font-label-sm text-label-sm text-tertiary">
            {(session?.role ?? 'sj').slice(0, 2).toUpperCase()}
          </span>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void logout()}
          className="px-sm py-xs rounded border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-variant font-label-sm text-label-sm flex items-center gap-xs disabled:opacity-50"
          data-testid="logout-button"
        >
          <LogOut size={14} />
          Log out
        </button>
      </div>
    </header>
  );
}
