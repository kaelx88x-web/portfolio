import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        ink: '#15161a',
        panel: '#f7f8fb',
        line: '#d9dde7',
        success: '#147d52',
        danger: '#b42318',
        accent: '#2563eb',
        amber: '#b45309'
      },
      boxShadow: {
        soft: '0 10px 30px rgba(21, 22, 26, 0.08)'
      }
    }
  },
  plugins: []
} satisfies Config;
