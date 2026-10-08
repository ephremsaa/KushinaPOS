import React from 'react';
import { cn } from '../../lib/utils';

/**
 * All the status values that appear across the app.
 * Mapped to a single visual language — same color for the same state
 * on every page it appears.
 */
export type StatusValue =
  // Order
  | 'new' | 'preparing' | 'ready' | 'served' | 'cancelled'
  // Restaurant / account
  | 'pending' | 'active' | 'suspended' | 'rejected'
  // Subscription
  | 'trial' | 'grace'
  // Table
  | 'available' | 'occupied' | 'reserved' | 'cleaning'
  // Payment proof
  | 'approved'
  // Staff
  | 'inactive'
  // Generic
  | 'success' | 'warning' | 'error' | 'info';

export type BadgeColor =
  'green' | 'orange' | 'red' | 'blue' | 'gray' | 'purple' | 'amber' | 'indigo' | 'brand' | 'gold' | 'dark' | 'accent';

const STATUS_MAP: Record<StatusValue, BadgeColor> = {
  // Order lifecycle
  new:        'blue',
  preparing:  'amber',
  ready:      'brand',
  served:     'gray',
  cancelled:  'red',
  // Restaurant status
  pending:    'gold',
  active:     'brand',
  suspended:  'red',
  rejected:   'red',
  // Subscription
  trial:      'blue',
  grace:      'gold',
  // Table
  available:  'brand',
  occupied:   'red',
  reserved:   'gold',
  cleaning:   'gray',
  // Payment proof
  approved:   'brand',
  // Staff
  inactive:   'gray',
  // Generic
  success:    'brand',
  warning:    'gold',
  error:      'red',
  info:       'blue',
};

const COLOR_CLASS: Record<BadgeColor, string> = {
  green:  'badge-brand',
  orange: 'badge-orange',
  red:    'badge-red',
  blue:   'badge-blue',
  gray:   'badge-gray',
  purple: 'badge-purple',
  amber:  'badge-amber',
  indigo: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  brand:  'badge-brand',
  gold:   'badge-gold',
  dark:   'badge-dark',
  accent: 'bg-accent/20 text-brand-800 border border-accent/40',
};

const DOT_COLOR: Record<BadgeColor, string> = {
  green:  'bg-brand-500',
  orange: 'bg-orange-500',
  red:    'bg-red-500',
  blue:   'bg-blue-500',
  gray:   'bg-surface-400',
  purple: 'bg-purple-500',
  amber:  'bg-amber-500',
  indigo: 'bg-indigo-500',
  brand:  'bg-brand-500',
  gold:   'bg-gold-500',
  dark:   'bg-surface-900',
  accent: 'bg-accent',
};

export interface BadgeProps {
  /** Auto-maps status → color using the canonical status vocabulary */
  status?: StatusValue;
  /** Override with an explicit color */
  color?:  BadgeColor;
  /** Alias for color */
  variant?: BadgeColor | string;
  /** Show a filled dot before the label */
  dot?:    boolean;
  /** Pulse the dot (for live/urgent states) */
  pulse?:  boolean;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ status, color, variant, dot, pulse, children, className }: BadgeProps) {
  const chosenColor = (color || variant) as BadgeColor | undefined;
  const resolvedColor: BadgeColor =
    chosenColor && COLOR_CLASS[chosenColor]
      ? chosenColor
      : status
      ? STATUS_MAP[status] || 'gray'
      : 'gray';


  return (
    <span className={cn(COLOR_CLASS[resolvedColor], 'badge', className)}>
      {dot && (
        <span className="relative flex h-2 w-2 flex-shrink-0">
          {pulse && (
            <span
              className={cn(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                DOT_COLOR[resolvedColor]
              )}
            />
          )}
          <span
            className={cn(
              'relative inline-flex rounded-full h-2 w-2',
              DOT_COLOR[resolvedColor]
            )}
          />
        </span>
      )}
      {children}
    </span>
  );
}
