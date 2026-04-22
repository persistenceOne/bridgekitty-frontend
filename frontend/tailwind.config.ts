import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Poppins', 'sans-serif'],
        body:    ['Poppins', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        amber: {
          50:  '#FFF8EC',
          100: '#FFF0D0',
          200: '#FFE0A0',
          300: '#F5C46A',
          400: '#E59636',   // Persistence Orange
          500: '#c97d1e',
          600: '#a66410',
        },
        caramel: {
          100: '#F5E6D0',
          200: '#E5C89A',
          300: '#C09060',
          400: '#633C0D',   // Caramel
          500: '#4a2a08',
          600: '#350B00',   // Dark brown
        },
        brand: {
          black: '#1D1306',
          brown: '#350B00',
          white: '#FFFFFF',
        },
      },
      boxShadow: {
        card: '0 14px 36px rgba(29, 19, 6, 0.12)',
        glow: '0 0 0 1px rgba(255,255,255,0.75), 0 16px 32px rgba(229, 150, 54, 0.22)',
      },
    },
  },
  plugins: [],
} satisfies Config;
