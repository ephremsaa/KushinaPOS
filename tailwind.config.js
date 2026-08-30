/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  'color-mix(in srgb, var(--brand-500) 5%, white)',
          100: 'color-mix(in srgb, var(--brand-500) 15%, white)',
          200: 'color-mix(in srgb, var(--brand-500) 30%, white)',
          300: 'color-mix(in srgb, var(--brand-500) 45%, white)',
          400: 'color-mix(in srgb, var(--brand-500) 70%, white)',
          500: 'var(--brand-500)',
          600: 'color-mix(in srgb, var(--brand-500) 80%, black)',
          700: 'color-mix(in srgb, var(--brand-500) 65%, black)',
          800: 'color-mix(in srgb, var(--brand-500) 50%, black)',
          900: 'color-mix(in srgb, var(--brand-500) 35%, black)',
          950: 'color-mix(in srgb, var(--brand-500) 20%, black)',
        },
        surface: {
          50:  '#fbfcfe', // Ultra-clean premium light background
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-soft': 'pulseSoft 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(24px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        }
      },
      boxShadow: {
        'glow': '0 0 24px color-mix(in srgb, var(--brand-500) 40%, transparent)',
        'glow-sm': '0 0 12px color-mix(in srgb, var(--brand-500) 30%, transparent)',
        'card': '0 4px 24px -6px rgba(0,0,0,0.05), 0 2px 8px -4px rgba(0,0,0,0.02)',
        'card-hover': '0 12px 32px -8px rgba(0,0,0,0.08), 0 4px 12px -4px rgba(0,0,0,0.04)',
        'glass': 'inset 0 1px 1px rgba(255,255,255,0.8), 0 8px 32px rgba(0,0,0,0.04)',
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 100%)',
      }
    },
  },
  plugins: [],
};
