import { env } from '$env/dynamic/private';
import { redisGet, redisSet } from '$lib/server/redis';
import type { Plate } from './types';

const PLATE_TTL = 60 * 60 * 24; // 24h — plates rarely change
const HOLDER_TTL = 60 * 60 * 24;
// 50 is the hard cap enforced by the bridge /quotes/institutional-holders endpoint;
// do not raise this value or holder requests will be rejected.
const CHUNK = 50;

function bridgeBase(): string {
  return env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Plate membership per ticker, Redis-cached (24h) per ticker so a second run makes
 * no redundant Moomoo calls. Cache misses are fetched from the bridge in chunks and
 * backfilled. Redis being unavailable degrades to a direct fetch (best-effort).
 */
export async function getPlateMembership(
  tickers: string[],
  opts: { force?: boolean } = {}
): Promise<Record<string, Plate[]>> {
  const result: Record<string, Plate[]> = {};
  const misses: string[] = [];

  for (const t of tickers) {
    if (!opts.force) {
      const hit = await safeGet(`kg:plates:${t}`);
      if (hit) { result[t] = JSON.parse(hit); continue; }
    }
    misses.push(t);
  }

  for (const group of chunk(misses, CHUNK)) {
    try {
      const res = await fetch(
        `${bridgeBase()}/quotes/plate-membership?codes=${encodeURIComponent(group.join(','))}`,
        { signal: AbortSignal.timeout(20000) }
      );
      if (!res.ok) continue;
      const body = await res.json();
      for (const m of body.memberships ?? []) {
        const code = String(m.code).toUpperCase();
        const plates: Plate[] = m.plates ?? [];
        result[code] = plates;
        await safeSet(`kg:plates:${code}`, JSON.stringify(plates), PLATE_TTL);
      }
    } catch {
      continue; // skip a bad chunk, keep the rest (matches sectors/refresh)
    }
  }

  for (const t of tickers) if (!result[t]) result[t] = [];
  return result;
}

/** Best-effort institutional holders per ticker, Redis-cached (24h). Empty on absence. */
export async function getInstitutionalHolders(
  tickers: string[],
  opts: { force?: boolean } = {}
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  const misses: string[] = [];

  for (const t of tickers) {
    if (!opts.force) {
      const hit = await safeGet(`kg:holders:${t}`);
      if (hit) { result[t] = JSON.parse(hit); continue; }
    }
    misses.push(t);
  }

  for (const group of chunk(misses, CHUNK)) {
    try {
      const res = await fetch(
        `${bridgeBase()}/quotes/institutional-holders?codes=${encodeURIComponent(group.join(','))}`,
        { signal: AbortSignal.timeout(20000) }
      );
      if (!res.ok) continue;
      const body = await res.json();
      for (const h of body.holdings ?? []) {
        const code = String(h.code).toUpperCase();
        const holders: string[] = h.holders ?? [];
        result[code] = holders;
        await safeSet(`kg:holders:${code}`, JSON.stringify(holders), HOLDER_TTL);
      }
    } catch {
      continue;
    }
  }

  for (const t of tickers) if (!result[t]) result[t] = [];
  return result;
}

async function safeGet(key: string): Promise<string | null> {
  try { return await redisGet(key); } catch { return null; }
}
async function safeSet(key: string, value: string, ttl: number): Promise<void> {
  try { await redisSet(key, value, ttl); } catch { /* cache best-effort */ }
}
