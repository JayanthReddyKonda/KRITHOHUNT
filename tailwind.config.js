/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design System Tokens (DESIGN.md)
        surface: {
          0: 'hsl(var(--surface-0))', // #060a12
          1: 'hsl(var(--surface-1))', // #0b1120
          2: 'hsl(var(--surface-2))', // #121a2e
          3: 'hsl(var(--surface-3))', // #1a243c
        },
        border: {
          subtle: 'hsl(var(--border-subtle))', // #26324a
          strong: 'hsl(var(--border-strong))', // #3a4860
        },
        text: {
          primary: 'hsl(var(--text-primary))',   // #f1f5f9
          secondary: 'hsl(var(--text-secondary))', // #a8b8d0
          muted: 'hsl(var(--text-muted))',       // #7c8da8
          inverse: 'hsl(var(--text-inverse))',   // #060a12
        },
        accent: {
          red: 'hsl(var(--accent-red))',       // #ef3b3b
          blue: 'hsl(var(--accent-blue))',     // #3a86ff
          green: 'hsl(var(--accent-green))',   // #22c55e
          yellow: 'hsl(var(--accent-yellow))', // #eab308
          purple: 'hsl(var(--accent-purple))', // #a855f7
          orange: 'hsl(var(--accent-orange))', // #f97316
          indigo: 'hsl(var(--accent-indigo))', // #6366f1
        },
        feedback: {
          success: 'hsl(var(--feedback-success))', // #22c55e
          warning: 'hsl(var(--feedback-warning))', // #fbbf24
          error: 'hsl(var(--feedback-error))',     // #ef4444
        },
        // Legacy hunt palette (kept for backward compat)
        hunt: {
          red: '#EF4444',
          blue: '#3B82F6',
          green: '#10B981',
          yellow: '#F59E0B',
          purple: '#8B5CF6',
          orange: '#F97316',
        }
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
