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
        // StudyFlow brand palette — sourced from official brand mark
        canvas: {
          light: '#FAF7F2',   // warm cream parchment (logo background tone)
          dark: '#0D0F14',    // deep obsidian for night sessions
        },
        surface: {
          light: '#FFFFFF',
          dark: '#13151B',
          elevatedLight: '#F3EDE3',  // warm elevated surface matching cream palette
          elevatedDark: '#1A1D25',
        },
        zinc: {
          750: '#27282f',
          850: '#14151a',
        },
        brand: {
          navy: '#1A2A4A',    // the deep navy of the S mark
          navyLight: '#243660', // hover / lighter navy
          gold: '#C19B45',    // warm gold highlights
          goldLight: '#D4B56A', // lighter gold
          cream: '#FAF7F2',   // warm white / parchment
          creamDark: '#F0E8D8', // deeper cream for borders/dividers
          dark: '#1A2A4A',    // alias for consistency
          primary: '#1A2A4A', // primary action colour = navy
          light: '#F3EDE3',   // light tint for badges
          accent: '#C19B45',  // accent = gold
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#EF4444'
        }
      },
      // One step up from Tailwind's defaults so body text is no longer 12px everywhere.
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        xs: ['0.8125rem', { lineHeight: '1.25rem' }],
        sm: ['0.9375rem', { lineHeight: '1.5rem' }],
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
