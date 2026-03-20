import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(217 26% 24%)',
        input: 'hsl(217 24% 16%)',
        ring: 'hsl(208 88% 67%)',
        background: 'hsl(222 52% 8%)',
        foreground: 'hsl(213 31% 94%)',
        primary: {
          DEFAULT: 'hsl(221 83% 58%)',
          foreground: 'hsl(0 0% 100%)'
        },
        secondary: {
          DEFAULT: 'hsl(217 27% 20%)',
          foreground: 'hsl(213 31% 94%)'
        },
        muted: {
          DEFAULT: 'hsl(217 27% 17%)',
          foreground: 'hsl(215 18% 71%)'
        },
        accent: {
          DEFAULT: 'hsl(191 78% 41%)',
          foreground: 'hsl(0 0% 100%)'
        },
        destructive: {
          DEFAULT: 'hsl(0 72% 51%)',
          foreground: 'hsl(0 0% 100%)'
        },
        card: {
          DEFAULT: 'hsl(221 44% 12%)',
          foreground: 'hsl(213 31% 94%)'
        }
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.35rem'
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.06), 0 12px 40px rgba(2, 8, 23, 0.55)'
      }
    }
  },
  plugins: []
};

export default config;
