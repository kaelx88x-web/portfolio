import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    alias: {
      '$app/environment': path.resolve('./src/lib/__mocks__/$app/environment.ts'),
    },
  },
});
