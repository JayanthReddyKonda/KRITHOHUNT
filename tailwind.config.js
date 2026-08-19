/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          0: 'hsl(var(--surface-0))',
          1: 'hsl(var(--surface-1))',
          2: 'hsl(var(--surface-2))',
          3: 'hsl(var(--surface-3))',
        },
        border: {
          subtle: 'hsl(var(--border-subtle))',
          strong: 'hsl(var(--border-strong))',
        },
        text: {
          primary: 'hsl(var(--text-primary))',
          secondary: 'hsl(var(--text-secondary))',
          muted: 'hsl(var(--text-muted))',
          inverse: 'hsl(var(--text-inverse))',
        },
        accent: {
          violet: 'hsl(var(--accent-violet))',
          amber: 'hsl(var(--accent-amber))',
          emerald: 'hsl(var(--accent-emerald))',
          rose: 'hsl(var(--accent-rose))',
          cyan: 'hsl(var(--accent-cyan))',
          orange: 'hsl(var(--accent-orange))',
          brand: 'hsl(var(--accent-brand))',
        },
        feedback: {
          success: 'hsl(var(--feedback-success))',
          warning: 'hsl(var(--feedback-warning))',
          error: 'hsl(var(--feedback-error))',
        },
      },
      fontSize: {
        'display': ['clamp(2.25rem, 6vw, 3rem)', { lineHeight: '1.1', fontWeight: '800' }],
        'h1': ['clamp(1.5rem, 4vw, 2rem)', { lineHeight: '1.2', fontWeight: '700' }],
        'h2': ['clamp(1.125rem, 3vw, 1.375rem)', { lineHeight: '1.3', fontWeight: '600' }],
        'body': ['0.9375rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
        'micro': ['0.6875rem', { lineHeight: '1.3', fontWeight: '600' }],
        'button': ['0.8125rem', { lineHeight: '1.2', fontWeight: '700' }],
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '24px',
        '6': '32px',
      },
      borderRadius: {
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
      },
      transitionDuration: {
        'fast': '120ms',
        'base': '200ms',
        'slow': '350ms',
      },
      transitionTimingFunction: {
        'standard': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'emphasized': 'cubic-bezier(0.05, 0.85, 0.25, 1)',
      },
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
    },
  },
  plugins: [],
}