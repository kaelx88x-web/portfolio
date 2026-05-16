import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function createTheme() {
  const initial: 'dark' | 'light' = browser
    ? ((localStorage.getItem('portfolioai_theme') ?? 'light') as 'dark' | 'light')
    : 'light';
  const { subscribe, update } = writable(initial);
  return {
    subscribe,
    toggle() {
      update(t => {
        const next = t === 'dark' ? 'light' : 'dark';
        if (browser) {
          localStorage.setItem('portfolioai_theme', next);
          document.documentElement.setAttribute('data-theme', next);
        }
        return next;
      });
    },
    init() {
      if (browser) {
        const t = localStorage.getItem('portfolioai_theme') ?? 'light';
        document.documentElement.setAttribute('data-theme', t);
      }
    },
  };
}

export const theme = createTheme();
