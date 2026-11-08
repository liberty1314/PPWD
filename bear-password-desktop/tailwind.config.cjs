module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,vue}', '../shared/ui/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--bp-bg)',
        surface: 'var(--bp-surface)',
        text: 'var(--bp-text)',
        accent: 'var(--bp-accent)',
        border: 'var(--bp-border)'
      },
      borderRadius: {
        control: 'var(--bp-radius-md)'
      }
    }
  },
  plugins: []
}
