import React from 'react';
import { PackageSearch } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?:        React.ReactNode;
  title:        string;
  description?: string;
  action?:      {
    label:   string;
    onClick: () => void;
    icon?:   React.ReactNode;
  };
  size?:        'sm' | 'md' | 'lg';
  className?:   string;
}

const SIZE: Record<'sm' | 'md' | 'lg', { icon: string; title: string; desc: string }> = {
  sm: { icon: 'w-10 h-10', title: 'text-base',   desc: 'text-xs'  },
  md: { icon: 'w-14 h-14', title: 'text-lg',     desc: 'text-sm'  },
  lg: { icon: 'w-20 h-20', title: 'text-xl',     desc: 'text-base'},
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
  className,
}: EmptyStateProps) {
  const s = SIZE[size];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-16 px-6',
        className
      )}
    >
      <div
        className={cn(
          s.icon,
          'rounded-3xl flex items-center justify-center mb-5 flex-shrink-0 border'
        )}
        style={{ backgroundColor: 'var(--empty-state-bg)', borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}
      >
        {icon ?? <PackageSearch className="w-1/2 h-1/2" />}
      </div>

      <h3
        className={cn(s.title, 'font-display font-bold mb-2')}
        style={{ color: 'var(--text-main)' }}
      >
        {title}
      </h3>

      {description && (
        <p
          className={cn(s.desc, 'max-w-xs leading-relaxed mb-6')}
          style={{ color: 'var(--text-muted)' }}
        >
          {description}
        </p>
      )}

      {action && (
        <Button
          variant="primary"
          icon={action.icon}
          onClick={action.onClick}
          size="sm"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
