/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'seraj-bg': '#090A0B',
        'seraj-card': '#171718',
        'seraj-orange': '#F69A46',
        'seraj-text': '#F7F1EB',
        'seraj-muted': '#B7AEA5',
      },
      fontFamily: {
        vazir: ['Vazirmatn', 'Tahoma', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
