import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'gold' | 'dark';
export type ButtonSize    = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.HTMLAttributes<HTMLElement> {
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  loading?:   boolean;
  icon?:      React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  /** Render as a different element (e.g. 'a', Link, etc.). Props are spread onto it. */
  as?: any;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  [key: string]: any;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:   'btn-primary',
  secondary: 'btn-secondary',
  ghost:     'btn-ghost',
  danger:    'btn-danger',
  success:   'btn-success',
  gold:      'btn-gold',
  dark:      'btn bg-surface-900 hover:bg-surface-950 text-white shadow-md',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant  = 'secondary',
      size     = 'md',
      loading  = false,
      icon,
      iconRight,
      fullWidth,
      disabled,
      className,
      children,
      as: Tag  = 'button',
      type     = 'button',
      ...props
    },
    ref
  ) => {
    const isButton = Tag === 'button';

    return (
      <Tag
        ref={ref}
        {...(isButton ? { disabled: disabled || loading, type } : {})}
        className={cn(
          VARIANT_CLASS[variant as ButtonVariant] || VARIANT_CLASS.secondary,
          SIZE_CLASS[size as ButtonSize] || '',
          fullWidth && 'w-full',
          (disabled || loading) && !isButton && 'pointer-events-none opacity-60',
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
        ) : icon ? (
          <span className="flex-shrink-0">{icon}</span>
        ) : null}
        {children}
        {iconRight && !loading && (
          <span className="flex-shrink-0">{iconRight}</span>
        )}
      </Tag>
    );
  }
);


Button.displayName = 'Button';
