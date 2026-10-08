import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalFooterAction {
  label:     string;
  onClick:   () => void;
  variant?:  'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  loading?:  boolean;
  disabled?: boolean;
  icon?:     React.ReactNode;
}

export interface ModalProps {
  open:         boolean;
  onClose:      () => void;
  title?:       string;
  subtitle?:    string;
  description?: string;
  icon?:        React.ReactNode;
  size?:        ModalSize;
  footer?:      ModalFooterAction[] | React.ReactNode;
  /** Prevent closing by clicking the backdrop */
  persistent?:  boolean;
  children:     React.ReactNode;
  className?:   string;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm:   'max-w-sm',
  md:   'max-w-lg',
  lg:   'max-w-2xl',
  xl:   'max-w-4xl',
  full: 'max-w-[95vw]',
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  description,
  icon,
  size = 'md',
  footer,
  persistent,
  children,
  className,
}: ModalProps) {

  // Escape key
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !persistent) onClose();
    },
    [onClose, persistent]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKey);
    // Prevent body scroll while modal is open
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = overflow;
    };
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={persistent ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn('modal-box', SIZE_CLASS[size], className)}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || icon) && (
          <div className="modal-header">
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                {title && (
                  <h3 className="font-display font-black text-lg text-surface-900 leading-tight truncate">
                    {title}
                  </h3>
                )}
                {(subtitle || description) && (
                  <p className="text-xs text-surface-500 mt-0.5">{subtitle || description}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-surface-400 hover:text-surface-700 hover:bg-surface-100 transition-colors flex-shrink-0 ml-4 cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="modal-body">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="modal-footer">
            {Array.isArray(footer) ? (
              footer.map((action, i) => (
                <Button
                  key={i}
                  variant={action.variant ?? 'secondary'}
                  loading={action.loading}
                  disabled={action.disabled}
                  icon={action.icon}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))
            ) : (
              footer
            )}
          </div>
        )}
      </div>
    </div>
  );
}
