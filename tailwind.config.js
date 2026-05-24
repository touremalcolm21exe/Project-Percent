/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#e8f9fc',
          100: '#c4eff7',
          200: '#8dddf0',
          300: '#4dc8e6',
          400: '#00b8d9',
          500: '#00a3c4',
          600: '#0088a8',
          700: '#006b88',
          800: '#004f68',
          900: '#2d3091',
          950: '#1e2070',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #2d3091 0%, #0088a8 50%, #00c8d4 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, #3b3fa0 0%, #0099bb 60%, #00c8d4 100%)',
      },
    },
  },
  plugins: [],
};
