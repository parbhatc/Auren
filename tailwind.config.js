import colors from 'tailwindcss/colors'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontSize: {
        tiny: ['10px', { lineHeight: '14px' }],
      },
      colors: {
        // Treat legacy slate utilities as neutral zinc so dark surfaces do not
        // pick up a navy cast while components are incrementally consolidated.
        slate: colors.zinc,
        // Legacy utility names resolve to the approved cobalt palette so no
        // page can leak purple/indigo while older components are migrated.
        violet: colors.blue,
        purple: colors.blue,
        indigo: colors.blue,
        fuchsia: colors.blue,
        dom: {
          border: '#475569',
          header: '#7d8590',
          price: '#adbac7',
        },
        grey: {
          500: '#7d8590',
          700: '#adbac7',
        },
      },
    },
  },
  plugins: [],
}

