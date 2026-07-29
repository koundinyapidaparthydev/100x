import { Link, useLocation } from 'react-router-dom';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Compass, 
  FileCheck, 
  Brain, 
  Cloud, 
  ShieldAlert, 
  History, 
  Settings 
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Boards', path: '/boards', icon: Compass },
  { name: 'Policies', path: '/policies', icon: FileCheck },
  { name: 'Models', path: '/models', icon: Brain },
  { name: 'Cloud', path: '/cloud', icon: Cloud },
  { name: 'PII Rules', path: '/pii-rules', icon: ShieldAlert },
  { name: 'Audit Log', path: '/audit-log', icon: History },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <nav className="w-[280px] h-screen fixed left-0 top-0 bg-surface-dim border-r border-outline-variant flex flex-col py-lg z-40 hidden md:flex">
      <div className="px-lg mb-xl flex items-center gap-md">
        <div className="w-10 h-10 rounded bg-tertiary/20 flex items-center justify-center border border-tertiary/30 cyan-glow">
          <ShieldCheck className="text-tertiary" size={24} fill="currentColor" />
        </div>
        <div>
          <h1 className="font-headline-sm text-headline-sm font-bold text-tertiary">OffshoreHelper</h1>
          <p className="font-label-sm text-label-sm text-on-surface-variant">Enterprise AI Governance</p>
        </div>
      </div>
      <ul className="flex-1 flex flex-col gap-sm px-md overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <li key={item.name}>
              <Link
                to={item.path}
                className={`flex items-center gap-md px-md py-sm rounded-lg font-label-md text-label-md transition-all duration-200 group ${
                  isActive
                    ? 'text-tertiary border-l-4 border-tertiary bg-surface-container-highest translate-x-1'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high border-l-4 border-transparent'
                }`}
              >
                <Icon
                  size={20}
                  className={isActive ? 'text-tertiary' : 'group-hover:text-on-surface transition-colors'}
                  fill={isActive ? 'currentColor' : 'none'}
                />
                {item.name}
              </Link>
            </li>
          );
        })}
        <li className="mt-auto pt-sm border-t border-outline-variant/30">
          <Link
            to="/admin"
            className={`flex items-center gap-md px-md py-sm rounded-lg font-label-md text-label-md transition-all duration-200 group ${
              location.pathname.startsWith('/admin')
                ? 'text-tertiary border-l-4 border-tertiary bg-surface-container-highest translate-x-1'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high border-l-4 border-transparent'
            }`}
          >
            <Settings
              size={20}
              className={location.pathname.startsWith('/admin') ? 'text-tertiary' : 'group-hover:text-on-surface transition-colors'}
              fill={location.pathname.startsWith('/admin') ? 'currentColor' : 'none'}
            />
            Admin
          </Link>
        </li>
      </ul>
      <div className="px-md mt-md">
        <div className="bg-surface-container-high/60 backdrop-blur-md border border-outline-variant p-md rounded-lg">
          <div className="flex items-center justify-between mb-sm">
            <span className="font-label-sm text-label-sm text-on-surface-variant">System Status</span>
            <div className="flex items-center gap-xs text-tertiary">
              <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
              <span className="font-label-sm text-label-sm">Operational</span>
            </div>
          </div>
          <div className="w-full bg-surface-dim h-1 rounded-full overflow-hidden">
            <div className="bg-tertiary w-[98%] h-full rounded-full"></div>
          </div>
        </div>
      </div>
    </nav>
  );
}
