/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#a855f7', // fuchsia-500
          accent: '#22d3ee',  // cyan-400
        },
      },
      borderRadius: {
        xl: '14px',
        '2xl': '16px',
      },
      boxShadow: {
        brand: '0 10px 30px -12px rgba(168,85,247,.35), 0 20px 60px -32px rgba(34,211,238,.25)',
      },
    },
  },
  plugins: [],
}