import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        bg:      '#080d18',
        card:    '#0f1523',
        border:  '#1a2038',
        primary: '#6c8fff',
        success: '#2dd4a0',
        danger:  '#f96b7e',
        warning: '#fbbf24',
        ink:     '#dce8ff',
        muted:   '#7a8fb0',
        sidebar: '#090e1d',
        ai:      '#0e1830',
      },
      boxShadow: {
        card:          '0 4px 24px rgba(0,0,0,0.45)',
        glow:          '0 0 32px rgba(108,143,255,0.18)',
        'glow-success':'0 0 24px rgba(45,212,160,0.15)',
      },
      borderRadius: {
        DEFAULT: '10px',
        sm: '6px',
      },
    },
  },
  plugins: [],
} satisfies Config;
