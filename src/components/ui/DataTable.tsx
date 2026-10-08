import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { EmptyState } from './EmptyState';
import { TableSkeleton } from './Skeleton';

export interface DataTableColumn<T> {
  key:       keyof T | string;
  label:     string;
  sortable?: boolean;
  width?:    string;
  align?:    'left' | 'center' | 'right';
  render?:   (value: unknown, row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T extends Record<string, any> = Record<string, any>> {
  columns:     DataTableColumn<T>[];
  data:        T[];
  loading?:    boolean;
  keyField?:   keyof T;
  emptyTitle?:       string;
  emptyDescription?: string;
  emptyIcon?:        React.ReactNode;
  emptyAction?:      { label: string; onClick: () => void; icon?: React.ReactNode };
  className?:  string;
  onRowClick?: (row: T) => void;
  /** Number of skeleton rows to show while loading */
  skeletonRows?: number;
}

type SortDir = 'asc' | 'desc';

export function DataTable<T extends Record<string, any> = Record<string, any>>({
  columns,
  data,
  loading,
  keyField,

  emptyTitle       = 'No results',
  emptyDescription,
  emptyIcon,
  emptyAction,
  className,
  onRowClick,
  skeletonRows = 5,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (col: DataTableColumn<T>) => {
    if (!col.sortable) return;
    const k = String(col.key);
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const ALIGN: Record<'left' | 'center' | 'right', string> = {
    left:   'text-left',
    center: 'text-center',
    right:  'text-right',
  };

  return (
    <div className={cn('rounded-2xl overflow-hidden border border-surface-200 dark:border-surface-800', className)}>
      <div className="overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              {columns.map((col) => {
                const k = String(col.key);
                const isActive = sortKey === k;
                return (
                  <th
                    key={k}
                    style={{ width: col.width }}
                    className={cn(
                      ALIGN[col.align ?? 'left'],
                      col.sortable && 'cursor-pointer select-none hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors'
                    )}
                    onClick={() => handleSort(col)}
                    aria-sort={
                      isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      {col.label}
                      {col.sortable && (
                        <span className={cn('transition-colors', isActive ? 'text-brand-500' : 'text-surface-300')}>
                          {isActive ? (
                            sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronsUpDown className="w-3 h-3" />
                          )}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          {loading ? (
            <TableSkeleton rows={skeletonRows} cols={columns.length} />
          ) : sorted.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <EmptyState
                    icon={emptyIcon}
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {sorted.map((row, ri) => {
                const rowKey = keyField ? String(row[keyField as string]) : ri;
                return (
                  <tr
                    key={rowKey}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(onRowClick && 'cursor-pointer')}
                  >
                    {columns.map((col) => {
                      const k      = String(col.key);
                      const value  = row[k];
                      return (
                        <td key={k} className={cn(ALIGN[col.align ?? 'left'])}>
                          {col.render ? col.render(value, row, ri) : String(value ?? '—')}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
