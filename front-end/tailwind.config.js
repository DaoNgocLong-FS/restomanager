/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary:           '#0d5c63',
        'primary-dark':    '#094951',
        'primary-container':'#abeef6',
        secondary:         '#006a66',
        'secondary-container': '#84f2ec',
        'tertiary':        '#b45309',
        'tertiary-fixed':  '#fed7aa',
        surface:           '#f9f9fc',
        'surface-low':     '#f3f3f6',
        'surface-container': '#eeeef0',
        'surface-high':    '#e8e8ea',
        'on-surface':      '#1a1c1e',
        'on-surface-variant': '#3f484a',
        'on-primary-container': '#002022',
        'on-secondary-container': '#002020',
        muted:             '#6f797a',
        border:            '#bfc8c9',
        'border-soft':     '#e2e2e5',
        'outline-variant': '#bfc8c9',
        success:           '#15803d',
        warning:           '#b45309',
        danger:            '#b91c1c',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)',
        card: '0 4px 14px rgba(0,0,0,0.06)',
      },
      animation: {
        'pop-in': 'pop-in 120ms ease-out',
      },
      keyframes: {
        'pop-in': {
          from: { opacity: 0, transform: 'scale(.97) translateY(-2px)' },
          to:   { opacity: 1, transform: 'scale(1) translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
