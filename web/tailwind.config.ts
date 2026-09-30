import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1D1F23',
        'ink-dim': '#6E7580',
        surface: '#EEF1F0',
        'surface-soft': '#F4F6F5',
        accent: '#0A84FF',
      },
      fontFamily: {
        sans: [
          'Segoe UI',
          '-apple-system',
          'BlinkMacSystemFont',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      boxShadow: {
        floaty: '0 8px 24px -8px rgba(29, 31, 35, 0.18)',
        panel: '0 20px 60px -20px rgba(29, 31, 35, 0.35)',
      },
    },
  },
  plugins: [],
} satisfies Config
