/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'cn-bg': '#0a0a0f',
        'cn-surface': '#12121a',
        'cn-border': '#2a2a3a',
        'cn-text': '#e0e0e0',
        'cn-muted': '#888',
        'cn-accent': '#60a5fa',
        'cn-green': '#4ade80',
        'cn-yellow': '#facc15',
        'cn-red': '#f87171',
      },
    },
  },
  plugins: [],
};
