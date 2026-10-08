import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { cn } from '../../lib/utils';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'pill' | 'button';
  showLabel?: boolean;
}

export function LanguageSwitcher({
  className,
  variant = 'pill',
  showLabel = true,
}: LanguageSwitcherProps) {
  const { lang, setLang, toggleLang } = useLanguage();

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={toggleLang}
        className={cn(
          'px-3 py-2 rounded-2xl border border-surface-200 bg-white/80 hover:bg-white text-xs font-bold text-surface-800 flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95',
          className
        )}
        title="Toggle English / አማርኛ"
      >
        <Globe className="w-3.5 h-3.5 text-brand-500" />
        <span>{lang === 'en' ? '🇬🇧 EN' : '🇪🇹 አማ'}</span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center bg-surface-100/90 p-1 rounded-2xl border border-surface-200/80 text-xs font-bold',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setLang('en')}
        className={cn(
          'px-2.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1',
          lang === 'en'
            ? 'bg-white text-surface-900 shadow-xs font-extrabold'
            : 'text-surface-500 hover:text-surface-800'
        )}
      >
        <span>🇬🇧</span>
        {showLabel && <span>EN</span>}
      </button>

      <button
        type="button"
        onClick={() => setLang('am')}
        className={cn(
          'px-2.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 font-ethiopic',
          lang === 'am'
            ? 'bg-white text-surface-900 shadow-xs font-extrabold'
            : 'text-surface-500 hover:text-surface-800'
        )}
      >
        <span>🇪🇹</span>
        {showLabel && <span>አማርኛ</span>}
      </button>
    </div>
  );
}
