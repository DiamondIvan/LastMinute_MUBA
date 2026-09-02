/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#6B46C1',
          light: '#F3E8FF',
          dark: '#553C9A',
        },
        widget: {
          purple: '#E9D8FD',
          pink: '#FED7E2',
          blue: '#BEE3F8',
          green: '#C6F6D5',
        }
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      }
    },
  },
  plugins: [],
}