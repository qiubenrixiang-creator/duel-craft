/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 文明アクセント
        fire: '#FF8A3D',
        water: '#4FB8F5',
        nature: '#3FD08A',
        light: '#FFD24A',
        darkness: '#B47BF5',
      },
      transitionTimingFunction: {
        // 仕様書で指定された easing
        card: 'cubic-bezier(0.22,1,0.36,1)',
      },
    },
  },
  plugins: [],
};
