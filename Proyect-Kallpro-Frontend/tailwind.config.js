/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'navy': '#0D1F6E',
        'navy-mid': '#1A3DB5',
        'cyan': '#00B8E0',
        'cyan-dark': '#0086a8',
      },
    },
  },
  plugins: [],
}
