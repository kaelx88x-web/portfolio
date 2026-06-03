import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface LiveSettings {
  refreshIntervalMs: 10_000 | 30_000 | 60_000;
  enabledByDefault: boolean;
  showDelayedWarning: boolean;
}

const KEY = 'liveSettings';
const DEFAULTS: LiveSettings = { refreshIntervalMs: 10_000, enabledByDefault: false, showDelayedWarning: true };

function load(): LiveSettings {
  if (!browser) return DEFAULTS;
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; }
  catch { return DEFAULTS; }
}

export const liveSettings = writable<LiveSettings>(load());
if (browser) liveSettings.subscribe((v) => localStorage.setItem(KEY, JSON.stringify(v)));
