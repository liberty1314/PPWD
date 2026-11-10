module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,vue}', '../shared/ui/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--bp-bg)',
        surface: 'var(--bp-surface)',
        text: 'var(--bp-text)',
        accent: 'var(--bp-accent)',
        border: 'var(--bp-border)',
        neutral: {
          50: 'var(--bp-neutral-50)',
          100: 'var(--bp-neutral-100)',
          200: 'var(--bp-neutral-200)',
          300: 'var(--bp-neutral-300)',
          400: 'var(--bp-neutral-400)',
          500: 'var(--bp-neutral-500)',
          600: 'var(--bp-neutral-600)',
          700: 'var(--bp-neutral-700)',
          800: 'var(--bp-neutral-800)',
          900: 'var(--bp-neutral-900)',
          950: 'var(--bp-neutral-950)'
        }
      },
      borderRadius: {
        control: 'var(--bp-radius-md)'
      }
    }
  },
  plugins: []
}
