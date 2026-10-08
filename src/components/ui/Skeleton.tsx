import React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonProps {
  className?: string;
  width?:     string | number;
  height?:    string | number;
  rounded?:   'sm' | 'md' | 'lg' | 'full';
  lines?:     number;
  lineGap?:   string;
}

const ROUND: Record<'sm' | 'md' | 'lg' | 'full', string> = {
  sm:   'rounded',
  md:   'rounded-xl',
  lg:   'rounded-2xl',
  full: 'rounded-full',
};

/** Single shimmer skeleton block */
export function Skeleton({ className, width, height, rounded = 'md' }: Omit<SkeletonProps, 'lines' | 'lineGap'>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-surface-200 dark:bg-surface-700',
        ROUND[rounded],
        className
      )}
      style={{ width, height }}
      role="status"
      aria-label="Loading…"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 dark:via-white/10 to-transparent animate-shimmer" />
    </div>
  );
}

/** Multi-line text skeleton (e.g. paragraph, list row) */
export function SkeletonLines({ lines = 3, lineGap = '0.75rem', className }: SkeletonProps) {
  return (
    <div className={cn('flex flex-col', className)} style={{ gap: lineGap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="0.875rem"
          rounded="full"
          className={cn(i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

/** Full stat-card skeleton */
export function StatCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={cn(`grid gap-4`, `grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(count, 4)}`)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex items-start gap-4">
          <Skeleton width={48} height={48} rounded="lg" className="flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton height="1.75rem" rounded="md" className="w-2/3" />
            <Skeleton height="0.75rem" rounded="full" className="w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Table body skeleton */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr key={ri} className="border-b border-surface-100 dark:border-surface-800">
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} className="px-5 py-4">
              <Skeleton
                height="0.875rem"
                rounded="full"
                className={ci === 0 ? 'w-3/4' : 'w-1/2'}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
