import React, { useCallback } from 'react';
import { Delete } from 'lucide-react';
import { cn } from '../../lib/utils';

const KEY_LABELS: Record<number, string> = {
  1: '',
  2: 'ABC',
  3: 'DEF',
  4: 'GHI',
  5: 'JKL',
  6: 'MNO',
  7: 'PQRS',
  8: 'TUV',
  9: 'WXYZ',
  0: '+',
};

export interface PinPadProps {
  value:      string;
  onChange:   (value: string) => void;
  maxLength?: number;
  disabled?:  boolean;
  /** Apply shake animation on error */
  shaking?:   boolean;
  /** Show dots (●) instead of digits */
  masked?:    boolean;
  className?: string;
}

/**
 * Large-touch-target PIN pad — usable in a kitchen or at a counter.
 * Each key is at least 80×80px on desktop, 88×88px on touch devices.
 */
export function PinPad({
  value,
  onChange,
  maxLength = 6,
  disabled = false,
  shaking = false,
  masked = true,
  className,
}: PinPadProps) {
  const press = useCallback(
    (digit: string) => {
      if (disabled) return;
      if (value.length >= maxLength) return;
      onChange(value + digit);
    },
    [value, maxLength, onChange, disabled]
  );

  const backspace = useCallback(() => {
    if (disabled) return;
    onChange(value.slice(0, -1));
  }, [value, onChange, disabled]);

  const keys: Array<string | 'back' | 'empty'> = [
    '1','2','3',
    '4','5','6',
    '7','8','9',
    'empty','0','back',
  ];

  return (
    <div className={cn('flex flex-col items-center gap-5', className)}>
      {/* PIN dots display */}
      <div
        className={cn(
          'flex items-center gap-3 py-3 transition-all duration-150',
          shaking && 'animate-[pin-shake_0.45s_ease-in-out]'
        )}
        aria-label="PIN entry"
        aria-live="polite"
      >
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-4 h-4 rounded-full border-2 transition-all duration-150',
              i < value.length
                ? 'bg-brand-500 border-brand-500 scale-110'
                : 'bg-transparent border-surface-400 dark:border-surface-600'
            )}
          />
        ))}
      </div>

      {/* Keypad grid */}
      <div className="grid grid-cols-3 gap-3">
        {keys.map((key, idx) => {
          if (key === 'empty') {
            return <div key={idx} />;
          }

          if (key === 'back') {
            return (
              <button
                key={idx}
                onClick={backspace}
                disabled={disabled || value.length === 0}
                className={cn(
                  'pin-btn',
                  'disabled:opacity-30 disabled:cursor-not-allowed',
                  'w-20 h-20 sm:w-24 sm:h-24'
                )}
                aria-label="Backspace"
              >
                <Delete className="w-6 h-6" />
              </button>
            );
          }

          const num = parseInt(key, 10);
          return (
            <button
              key={idx}
              onClick={() => press(key)}
              disabled={disabled}
              className={cn(
                'pin-btn',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'w-20 h-20 sm:w-24 sm:h-24'
              )}
              aria-label={`Digit ${key}`}
            >
              <span className="font-display font-black text-2xl leading-none">
                {key}
              </span>
              {KEY_LABELS[num] && (
                <span className="text-[9px] font-bold tracking-widest text-surface-400 leading-none mt-0.5">
                  {KEY_LABELS[num]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
