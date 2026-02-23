const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    fontSize: {
      xs: 'var(--text-xs)',
      sm: 'var(--text-sm)',
      base: 'var(--text-base)',
      lg: 'var(--text-lg)',
      xl: 'var(--text-xl)',
      '2xl': 'var(--text-2xl)',
      '3xl': 'var(--text-3xl)',
    },
    spacing: {
      ...defaultTheme.spacing,
      '0': '0',
      '1': 'var(--space-1)',
      '2': 'var(--space-2)',
      '3': 'var(--space-3)',
      '4': 'var(--space-4)',
      '5': 'var(--space-5)',
      '6': 'var(--space-6)',
      '8': 'var(--space-8)',
      '10': 'var(--space-10)',
      '12': 'var(--space-12)',
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          light: 'var(--primary-light)',
          dark: 'var(--primary-dark)',
        },
        slate: {
          50: 'var(--slate-50)',
          100: 'var(--slate-100)',
          200: 'var(--slate-200)',
          300: 'var(--slate-300)',
          400: 'var(--slate-400)',
          500: 'var(--slate-500)',
          600: 'var(--slate-600)',
          700: 'var(--slate-700)',
          800: 'var(--slate-800)',
          900: 'var(--slate-900)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)',
      },
      maxWidth: {
        mobile: 'var(--container-max)',
      },
    },
  },
  plugins: [],
};
