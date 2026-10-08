/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef7ef',
          100: '#d7eed9',
          200: '#b1deb5',
          300: '#7BC67E', // Accent Mint Leaf
          400: '#4fa553',
          500: '#2F7D32', // Primary Forest Emerald
          600: '#246527',
          700: '#1d5020',
          800: '#173f19',
          900: '#102e12',
          950: '#081a0a',
        },
        gold: {
          50:  '#fdfaf0',
          100: '#faf3db',
          200: '#f5e4b2',
          300: '#eed282',
          400: '#e4be52',
          500: '#D4A72C', // Ethiopian Gold
          600: '#ba8d20',
          700: '#946c19',
          800: '#795619',
          900: '#654719',
          950: '#3a260a',
        },
        accent: {
          light: '#a3dba5',
          DEFAULT: '#7BC67E',
          dark: '#5ab05e',
        },
        surface: {
          50:  '#F7F7F2', // Warm cream canvas background
          100: '#f0f0ea',
          200: '#E2E8F0', // Soft clean border
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748B', // Muted slate text
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#172033', // Deep Navy Obsidian primary text & dark frame
          950: '#0d131f',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-soft': 'pulseSoft 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-urgent': 'pulseUrgent 1.5s ease-in-out infinite',
        'scale-in': 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.75' },
        },
        pulseUrgent: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.02)' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      boxShadow: {
        'glow': '0 0 24px rgba(47, 125, 50, 0.35)',
        'glow-sm': '0 0 12px rgba(47, 125, 50, 0.25)',
        'glow-accent': '0 0 20px rgba(123, 198, 126, 0.4)',
        'glow-gold': '0 0 20px rgba(212, 167, 44, 0.4)',
        'glow-emerald': '0 0 20px rgba(47, 125, 50, 0.3)',
        'glow-red': '0 0 20px rgba(239, 68, 68, 0.3)',
        'glow-amber': '0 0 20px rgba(245, 158, 11, 0.3)',
        'card': '0 4px 20px -4px rgba(23, 32, 51, 0.05), 0 2px 6px -2px rgba(23, 32, 51, 0.02)',
        'card-hover': '0 16px 36px -8px rgba(23, 32, 51, 0.09), 0 4px 12px -2px rgba(23, 32, 51, 0.04)',
        'card-premium': '0 20px 40px -15px rgba(23, 32, 51, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.8) inset',
        'glass': 'inset 0 1px 1px rgba(255, 255, 255, 0.9), 0 10px 30px rgba(23, 32, 51, 0.04)',
        'tactile': '0 4px 0 0 rgba(23, 32, 51, 0.12), 0 6px 16px rgba(23, 32, 51, 0.08)',
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.7) 100%)',
        'dark-glass-gradient': 'linear-gradient(135deg, rgba(23,32,51,0.95) 0%, rgba(13,19,31,0.85) 100%)',
      }
    },
  },
  plugins: [],
};
