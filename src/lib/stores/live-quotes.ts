import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { liveEnabled } from './live-toggle';
import { liveSettings } from './live-settings';
import type { MarketQuote, MarketSession } from '$lib/server/market-data/types';

export interface LiveQuote {
  last: number | null; changePct: number | null; bid: number | null; ask: number | null;
  volume: number | null; session: MarketSession; source: string; ts: number; stale: boolean;
}

export const liveQuotes = writable<Map<string, LiveQuote>>(new Map());

const refcounts = new Map<string, number>();
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

// Test seams (overridden in unit tests).
let _fetch: typeof fetch = browser ? fetch.bind(globalThis) : (async () => { throw new Error('no fetch'); }) as never;
let _isVisible: () => boolean = () => !browser || document.visibilityState === 'visible';
export function __setTestHooks(h: { fetch?: typeof fetch; isVisible?: () => boolean }) {
  if (h.fetch) _fetch = h.fetch;
  if (h.isVisible) _isVisible = h.isVisible;
}

function activeCodes(): string[] {
  return [...refcounts.entries()].filter(([, n]) => n > 0).map(([c]) => c).sort();
}

function anyMarketOpen(): boolean {
  const map = get(liveQuotes);
  const codes = activeCodes();
  if (codes.length === 0) return false;
  // Unknown (not yet fetched) counts as open so we can learn the session on the first tick.
  return codes.some((c) => (map.get(c)?.session ?? 'regular') !== 'closed');
}

async function tick() {
  if (inFlight) return;
  if (!get(liveEnabled) || !_isVisible()) return;
  const codes = activeCodes();
  if (codes.length === 0 || !anyMarketOpen()) return;
  inFlight = true;
  try {
    const res = await _fetch(`/api/quotes/live?codes=${encodeURIComponent(codes.join(','))}`);
    if (!res.ok) throw new Error(`live ${res.status}`);
    const body = await res.json() as { quotes: MarketQuote[] };
    liveQuotes.update((m) => {
      const next = new Map(m);
      for (const q of body.quotes) {
        next.set(q.symbol, { last: q.last, changePct: q.changePct, bid: q.bid, ask: q.ask, volume: q.volume, session: q.session, source: q.source, ts: q.ts, stale: false });
      }
      return next;
    });
  } catch {
    liveQuotes.update((m) => {
      const next = new Map(m);
      for (const c of codes) { const prev = next.get(c); if (prev) next.set(c, { ...prev, stale: true }); }
      return next;
    });
  } finally {
    inFlight = false;
  }
}

function ensureLoop() {
  if (timer || !browser) return;
  const interval = get(liveSettings).refreshIntervalMs;
  timer = setInterval(tick, interval);
}

function maybeStopLoop() {
  if (timer && activeCodes().length === 0) { clearInterval(timer); timer = null; }
}

/** Register interest in `codes`; returns an unsubscribe to call in onDestroy. */
export function subscribeQuotes(codes: string[]): () => void {
  for (const raw of codes) {
    const c = raw.trim().toUpperCase();
    refcounts.set(c, (refcounts.get(c) ?? 0) + 1);
  }
  ensureLoop();
  return () => {
    for (const raw of codes) {
      const c = raw.trim().toUpperCase();
      const n = (refcounts.get(c) ?? 1) - 1;
      if (n <= 0) refcounts.delete(c); else refcounts.set(c, n);
    }
    maybeStopLoop();
  };
}

/** Age of a quote in ms (null if unknown). */
export function quoteAge(code: string, now = Date.now()): number | null {
  const q = get(liveQuotes).get(code.trim().toUpperCase());
  return q ? now - q.ts : null;
}

// Restart the loop with a new interval when settings change.
if (browser) liveSettings.subscribe(() => { if (timer) { clearInterval(timer); timer = null; ensureLoop(); } });
