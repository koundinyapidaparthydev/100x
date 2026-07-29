import { Search, Lock, Bell, Settings, Menu } from 'lucide-react';

export default function Topbar() {
  return (
    <header className="bg-surface-container/90 backdrop-blur-md border-b border-outline-variant flex justify-between items-center h-16 px-xl sticky top-0 z-30">
      <div className="flex items-center gap-md md:hidden">
        <button className="p-sm rounded-full hover:bg-surface-variant transition-colors text-on-surface-variant">
          <Menu size={20} />
        </button>
        <span className="font-headline-md text-headline-md font-semibold text-on-surface">OffshoreHelper</span>
      </div>
      <div className="hidden md:flex flex-1 max-w-md">
        <div className="relative flex items-center w-full h-10 rounded-full bg-surface-variant focus-within:ring-1 focus-within:ring-tertiary transition-shadow">
          <Search size={18} className="text-on-surface-variant absolute left-3" />
          <input
            type="text"
            placeholder="Search logs, policies, models..."
            className="w-full h-full bg-transparent border-none focus:ring-0 text-body-sm text-on-surface pl-10 pr-md rounded-full placeholder:text-on-surface-variant/50 focus:outline-none"
          />
        </div>
      </div>
      <div className="flex items-center gap-sm">
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors relative group">
          <Lock size={20} className="group-hover:text-tertiary transition-colors" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-tertiary"></span>
        </button>
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-tertiary"></span>
        </button>
        <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-colors">
          <Settings size={20} />
        </button>
        <div className="h-8 w-px bg-outline-variant mx-sm hidden sm:block"></div>
        <div
          className="w-8 h-8 rounded-full bg-tertiary/15 border border-tertiary/40 flex items-center justify-center cursor-pointer hover:border-tertiary transition-colors"
          title="Sarah J."
        >
          <span className="font-label-sm text-label-sm text-tertiary">SJ</span>
        </div>
      </div>
    </header>
  );
}
