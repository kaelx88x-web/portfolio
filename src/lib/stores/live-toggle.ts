import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { liveSettings } from './live-settings';

const KEY = 'liveEnabled';

function load(): boolean {
  if (!browser) return false;
  const stored = localStorage.getItem(KEY);
  if (stored === null) return get(liveSettings).enabledByDefault;
  return stored === 'true';
}

export const liveEnabled = writable<boolean>(load());
if (browser) liveEnabled.subscribe((v) => localStorage.setItem(KEY, String(v)));
