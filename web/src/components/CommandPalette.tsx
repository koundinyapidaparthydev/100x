import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
  CONSOLE_NAV_ITEMS,
  CONSOLE_SEARCH_PLACEHOLDER,
  OPEN_COMMAND_PALETTE_EVENT,
} from '../lib/consoleNav';
import { cn } from '../lib/utils';

type PaletteItem = {
  id: string;
  label: string;
  hint: string;
  path: string;
  keywords: string[];
};

const EXTRA_ITEMS: PaletteItem[] = [
  {
    id: 'home',
    label: 'Workspace home',
    hint: 'Tickets & channels',
    path: '/home',
    keywords: ['home', 'widgets', 'tickets', 'slack'],
  },
  {
    id: 'console',
    label: 'Console home',
    hint: 'Identity & services',
    path: '/console',
    keywords: ['console', 'search', 'admin'],
  },
  {
    id: 'approvals',
    label: 'Approvals',
    hint: 'Governance',
    path: '/approvals',
    keywords: ['review', 'approvals'],
  },
];

const ITEMS: PaletteItem[] = [
  ...EXTRA_ITEMS.slice(0, 2),
  ...CONSOLE_NAV_ITEMS.map((item) => ({
    id: item.id,
    label: item.name,
    hint: item.hint,
    path: item.path,
    keywords: item.keywords,
  })),
  ...EXTRA_ITEMS.slice(1),
];

export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ITEMS;
    return ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.hint.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.includes(q)),
    );
  }, [query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const isPalette = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isPalette) {
        event.preventDefault();
        setOpen((prev) => !prev);
        setQuery('');
        setActive(0);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ query?: string }>).detail;
      setQuery(detail?.query ?? '');
      setActive(0);
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-on-surface/30 px-4 pt-[12vh] backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Search services"
      data-testid="command-palette"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-elevated">
        <div className="relative border-b border-outline-variant">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            aria-hidden="true"
          />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter' && results[active]) {
                e.preventDefault();
                go(results[active]!.path);
              }
            }}
            placeholder={CONSOLE_SEARCH_PLACEHOLDER}
            data-testid="command-palette-input"
            className="h-12 w-full bg-transparent pl-10 pr-3 text-sm outline-none placeholder:text-on-surface-variant"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-2" role="listbox">
          {results.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => go(item.path)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm',
                  index === active ? 'bg-primary-container text-on-primary-container' : 'hover:bg-surface-container-low',
                )}
              >
                <span className="font-medium">{item.label}</span>
                <span className="text-xs opacity-70">{item.hint}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-on-surface-variant">No matches</li>
          )}
        </ul>
      </div>
    </div>
  );
}
