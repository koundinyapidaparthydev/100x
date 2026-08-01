import { useEffect, useId, useRef, useState } from 'react';
import { ChevronsUpDown, X } from 'lucide-react';
import type { ServiceId } from '@shared/types';
import type { ServiceCatalogEntry } from '../../lib/serviceCatalog';
import { cn } from '../../lib/utils';

export type ServiceComboboxProps = {
  label: string;
  hint?: string;
  services: ServiceCatalogEntry[];
  selected: ServiceId[];
  onToggle: (id: ServiceId) => void;
  /** Prefix for input test id, e.g. service-search-conversation */
  searchTestId: string;
  /** Option / chip test id prefix — defaults to "service" → service-jira */
  optionTestIdPrefix?: string;
  placeholder?: string;
};

export function ServiceCombobox({
  label,
  hint,
  services,
  selected,
  onToggle,
  searchTestId,
  optionTestIdPrefix = 'service',
  placeholder = 'Search and select…',
}: ServiceComboboxProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selectedEntries = services.filter((s) => selected.includes(s.id) && !s.displayOnly);
  const displayOnly = services.filter((s) => s.displayOnly);
  const q = query.trim().toLowerCase();

  const options = services.filter((s) => {
    if (s.displayOnly) return false;
    if (selected.includes(s.id)) return false;
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
  });

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const add = (id: ServiceId) => {
    if (!selected.includes(id)) onToggle(id);
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  };

  const remove = (id: ServiceId) => {
    if (selected.includes(id)) onToggle(id);
  };

  return (
    <div ref={rootRef} className="space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p className="text-xs font-semibold text-on-surface">{label}</p>
        <p className="text-[11px] text-on-surface-variant">
          {hint ?? 'Search & add'}
          {selectedEntries.length > 0 ? ` · ${selectedEntries.length}` : ''}
        </p>
      </div>

      {selectedEntries.length > 0 && (
        <div className="flex flex-wrap gap-1" aria-label={`Selected ${label}`}>
          {selectedEntries.map((service) => (
            <span
              key={service.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/30 bg-primary-container py-0.5 pl-0.5 pr-1 text-[11px] text-on-primary-container"
            >
              <img
                src={service.logo}
                alt=""
                width={16}
                height={16}
                className="size-4 rounded-full object-contain bg-surface"
              />
              <span className="truncate font-medium">{service.name}</span>
              <button
                type="button"
                aria-label={`Remove ${service.name}`}
                data-testid={`${optionTestIdPrefix}-${service.id}`}
                onClick={() => remove(service.id)}
                className="inline-flex size-5 items-center justify-center rounded-full hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      {displayOnly.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {displayOnly.map((service) => (
            <span
              key={service.id}
              className="inline-flex items-center gap-1 rounded-full border border-outline-variant/70 bg-surface-container px-2 py-0.5 text-[11px] text-on-surface-variant"
            >
              <img
                src={service.logo}
                alt=""
                width={14}
                height={14}
                className="size-3.5 rounded-full object-contain bg-surface"
              />
              {service.name}
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <div
          className={cn(
            'flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant bg-surface px-2.5',
            'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15',
          )}
        >
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            data-testid={searchTestId}
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
                return;
              }
              if (e.key === 'Enter' && options[0]) {
                e.preventDefault();
                add(options[0].id);
              }
              if (e.key === 'Backspace' && !query && selectedEntries.length > 0) {
                remove(selectedEntries[selectedEntries.length - 1]!.id);
              }
            }}
            className="min-h-9 w-full flex-1 bg-transparent py-1.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/70"
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label="Show options"
            onClick={() => {
              setOpen((v) => !v);
              inputRef.current?.focus();
            }}
            className="text-on-surface-variant"
          >
            <ChevronsUpDown size={14} aria-hidden="true" />
          </button>
        </div>

        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-30 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-outline-variant bg-surface py-1 shadow-card"
          >
            {options.length === 0 ? (
              <li className="px-3 py-2 text-xs text-on-surface-variant">
                {q
                  ? `No match for “${query.trim()}”. Use Other below if we missed it.`
                  : 'All tools in this group are selected.'}
              </li>
            ) : (
              options.map((service) => (
                <li key={service.id} role="option">
                  <button
                    type="button"
                    data-testid={`${optionTestIdPrefix}-${service.id}`}
                    onClick={() => add(service.id)}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-primary-container/60 focus-visible:bg-primary-container/60 focus-visible:outline-none"
                  >
                    <img
                      src={service.logo}
                      alt=""
                      width={18}
                      height={18}
                      className="size-[18px] shrink-0 rounded-md object-contain bg-surface-container"
                    />
                    <span className="font-medium text-on-surface">{service.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
