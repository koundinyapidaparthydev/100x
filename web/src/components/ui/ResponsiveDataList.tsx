import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

export type DataColumn<T> = {
  key: string;
  label: ReactNode;
  render: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export interface ResponsiveDataListProps<T> {
  items: T[];
  columns: DataColumn<T>[];
  getKey: (item: T) => string;
  renderMobile?: (item: T) => ReactNode;
  caption?: string;
  getRowHref?: (item: T) => string | undefined;
  tableClassName?: string;
}

export function ResponsiveDataList<T>({
  items,
  columns,
  getKey,
  renderMobile,
  caption,
  getRowHref,
  tableClassName,
}: ResponsiveDataListProps<T>) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-outline-variant/80 bg-surface shadow-card md:block">
        <table className={cn('w-full table-fixed border-collapse text-left text-sm', tableClassName)}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="border-b border-outline-variant bg-surface-container-low text-xs text-on-surface-variant">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn('px-3 py-2.5 font-semibold', column.headerClassName, column.className)}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/70">
            {items.map((item) => {
              const href = getRowHref?.(item);
              return (
                <tr key={getKey(item)} className="align-middle hover:bg-surface-container-low/80">
                  {columns.map((column, index) => (
                    <td key={column.key} className={cn('min-w-0 px-3 py-2 text-on-surface', column.className)}>
                      <div className="min-w-0 truncate">
                        {href && index === 0 ? (
                          <Link to={href} className="font-medium hover:text-primary">
                            {column.render(item)}
                          </Link>
                        ) : (
                          column.render(item)
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 md:hidden">
        {items.map((item) => {
          const content = renderMobile
            ? renderMobile(item)
            : columns.map((column) => (
                <div key={column.key} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2 py-1 text-sm">
                  <span className="text-on-surface-variant">{column.label}</span>
                  <span className="min-w-0 truncate text-on-surface">{column.render(item)}</span>
                </div>
              ));
          const className = 'block min-w-0 rounded-card border border-outline-variant/80 bg-surface p-3 shadow-xs';
          const href = getRowHref?.(item);
          return href ? (
            <Link key={getKey(item)} to={href} className={`${className} hover:bg-surface-container-low`}>
              {content}
            </Link>
          ) : (
            <div key={getKey(item)} className={className}>
              {content}
            </div>
          );
        })}
      </div>
    </>
  );
}
