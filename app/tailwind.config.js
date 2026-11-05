/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          light: '#F8F9FA',
          dark: '#090A0C',
        },
        surface: {
          light: '#FBFCFE',
          dark: '#111215',
          elevatedLight: '#F1F3F5',
          elevatedDark: '#18191E',
        },
        zinc: {
          750: '#27282f',
          850: '#14151a',
        },
        brand: {
          dark: '#1D4ED8',
          primary: '#2563EB',
          light: '#EFF6FF',
          accent: '#3B82F6',
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#EF4444'
        }
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', '"Inter Variable"', 'sans-serif'],
        sans: ['"Inter Variable"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
