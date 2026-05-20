/** @type {import('tailwindcss').Config} */
export default {
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

