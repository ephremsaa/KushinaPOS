import React from 'react';
import { cn } from '../../lib/utils';

export type CardVariant = 'default' | 'hover' | 'premium' | 'glass' | 'glass-dark';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  as?:      React.ElementType;
}

const VARIANT_CLASS: Record<CardVariant, string> = {
  default:    'card',
  hover:      'card-hover',
  premium:    'card-premium',
  glass:      'glass-panel',
  'glass-dark': 'glass-dark-panel',
};

const PADDING_CLASS = {
  none: 'p-0',
  sm:   'p-3',
  md:   'p-6',   // matches .card default
  lg:   'p-8',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding, as: Tag = 'div', className, children, ...props }, ref) => {
    return (
      <Tag
        ref={ref}
        className={cn(
          VARIANT_CLASS[variant],
          padding && PADDING_CLASS[padding],
          className
        )}
        {...props}
      >
        {children}
      </Tag>
    );
  }
);
Card.displayName = 'Card';
