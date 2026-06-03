import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

beforeEach(() => { vi.resetModules(); localStorage.clear(); });

describe('live-settings', () => {
  it('defaults: interval 10s, live off, warning on', async () => {
    const { liveSettings } = await import('./live-settings');
    expect(get(liveSettings)).toEqual({ refreshIntervalMs: 10_000, enabledByDefault: false, showDelayedWarning: true });
  });
  it('persists changes to localStorage', async () => {
    const { liveSettings } = await import('./live-settings');
    liveSettings.update((s) => ({ ...s, refreshIntervalMs: 30_000 }));
    expect(JSON.parse(localStorage.getItem('liveSettings')!)).toMatchObject({ refreshIntervalMs: 30_000 });
  });
});
