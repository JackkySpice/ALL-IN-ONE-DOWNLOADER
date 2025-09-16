import tokens from './src/design/tokens.json' assert { type: 'json' }

const { brand, effects, radii, layout } = tokens

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['InterVariable', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'Apple Color Emoji', 'Segoe UI Emoji'],
      },
      borderRadius: {
        xl: radii.tailwind.xl,
        '2xl': radii.tailwind['2xl'],
        '3xl': radii.tailwind['3xl'],
      },
      boxShadow: {
        glow: effects.glow,
      },
      colors: {
        brand: {
          start: brand.start,
          mid: brand.mid,
          end: brand.end,
        },
      },
      backgroundImage: {
        brand: `linear-gradient(110deg, ${brand.start}, ${brand.mid}, ${brand.end})`,
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
      },
      animation: {
        'gradient-x': 'gradient-x 8s ease infinite',
      },
      maxWidth: {
        'screen-content': layout.contentWidth,
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
  ],
}
