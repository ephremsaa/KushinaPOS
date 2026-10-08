import React from 'react';
import { cn } from '../../lib/utils';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  activeIcon?: React.ElementType;
  inactiveIcon?: React.ElementType;
  id?: string;
  className?: string;
}

/**
 * Standard tactile switch
 */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  activeIcon: ActiveIcon,
  inactiveIcon: InactiveIcon,
  id,
  className,
}: ToggleProps) {
  const sizeConfig = {
    sm: {
      track: 'h-5 w-9 p-0.5',
      thumb: 'h-4 w-4',
      translate: 'translate-x-4',
      icon: 'w-2.5 h-2.5',
    },
    md: {
      track: 'h-7 w-12 p-1',
      thumb: 'h-5 w-5',
      translate: 'translate-x-5',
      icon: 'w-3 h-3',
    },
    lg: {
      track: 'h-9 w-16 p-1',
      thumb: 'h-7 w-7',
      translate: 'translate-x-7',
      icon: 'w-4 h-4',
    },
  }[size];

  const switchButton = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      className={cn(
        'relative inline-flex flex-shrink-0 cursor-pointer rounded-full transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 select-none active:scale-95',
        sizeConfig.track,
        checked
          ? 'bg-brand-600'
          : 'bg-surface-300 dark:bg-surface-600',
        disabled && 'opacity-50 cursor-not-allowed active:scale-100',
        className
      )}
    >
      <span
        className={cn(
          'pointer-events-none flex items-center justify-center rounded-full bg-white shadow-md transform transition-all duration-300 ease-out',
          sizeConfig.thumb,
          checked ? sizeConfig.translate : 'translate-x-0'
        )}
      >
        {checked && ActiveIcon ? (
          <ActiveIcon className={cn('text-brand-600', sizeConfig.icon)} />
        ) : !checked && InactiveIcon ? (
          <InactiveIcon className={cn('text-surface-400', sizeConfig.icon)} />
        ) : (
          <span
            className={cn(
              'rounded-full transition-colors',
              size === 'lg' ? 'w-2 h-2' : 'w-1.5 h-1.5',
              checked ? 'bg-brand-500' : 'bg-surface-300 dark:bg-surface-600'
            )}
          />
        )}
      </span>
    </button>
  );

  if (!label && !description) {
    return switchButton;
  }

  return (
    <label
      className={cn(
        'flex items-center justify-between gap-4 select-none',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer group'
      )}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
    >
      <div className="flex-1 min-w-0">
        {label && (
          <p className="text-sm font-semibold text-surface-800 dark:text-surface-100 group-hover:text-brand-600 transition-colors">
            {label}
          </p>
        )}
        {description && (
          <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {switchButton}
    </label>
  );
}

export interface LargeToggleProps extends Omit<ToggleProps, 'size'> {
  badgeText?: string;
  badgeVariant?: 'brand' | 'success' | 'amber' | 'neutral';
}

/**
 * Large tactile card toggle with prominent touch area, status glow, and responsive active states.
 */
export function LargeToggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  activeIcon: ActiveIcon,
  inactiveIcon: InactiveIcon,
  badgeText,
  badgeVariant = 'brand',
  id,
  className,
}: LargeToggleProps) {
  const badgeStyles = {
    brand: 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-800',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    neutral: 'bg-surface-100 text-surface-700 border-surface-200 dark:bg-surface-800 dark:text-surface-300 dark:border-surface-700',
  }[badgeVariant];

  return (
    <div
      id={id}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      className={cn(
        'group relative flex items-center justify-between gap-5 p-5 rounded-3xl border-2 transition-all duration-200 select-none cursor-pointer',
        checked
          ? 'bg-brand-50 border-brand-400 dark:bg-brand-950/30 dark:border-brand-600/50'
          : 'bg-white border-surface-200 hover:border-surface-300 shadow-sm dark:bg-surface-900 dark:border-surface-800',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className
      )}
    >
      {/* Left Text & Info */}
      <div className="space-y-1.5 flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <p className="font-display font-bold text-base text-surface-900 dark:text-surface-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
            {label}
          </p>
          {badgeText && (
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider', badgeStyles)}>
              {badgeText}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed max-w-xl">
            {description}
          </p>
        )}
      </div>

      {/* Chunky 64px Tactile Switch */}
      <div
        className={cn(
          'relative inline-flex h-9 w-16 flex-shrink-0 rounded-full transition-all duration-200 ease-out p-1',
          checked
            ? 'bg-brand-600'
            : 'bg-surface-200 dark:bg-surface-700'
        )}
      >
        <span
          className={cn(
            'pointer-events-none flex items-center justify-center h-7 w-7 rounded-full bg-white shadow-tactile transform transition-all duration-300 ease-out',
            checked ? 'translate-x-7 text-brand-600 scale-105' : 'translate-x-0 text-surface-400'
          )}
        >
          {checked && ActiveIcon ? (
            <ActiveIcon className="w-4 h-4 text-brand-600" />
          ) : !checked && InactiveIcon ? (
            <InactiveIcon className="w-4 h-4 text-surface-400" />
          ) : (
            <span
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                checked ? 'bg-brand-500' : 'bg-surface-300'
              )}
            />
          )}
        </span>
      </div>
    </div>
  );
}
