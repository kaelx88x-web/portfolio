export type Freshness = 'fresh' | 'warn' | 'block';

export const WARN_MS = 60_000;        // > 60s → warn
export const BLOCK_MS = 5 * 60_000;   // > 5min → block live orders

/** Classify a quote's age. null/unknown age → block (never trade on no data). */
export function assessQuoteFreshness(ageMs: number | null): Freshness {
  if (ageMs === null || !Number.isFinite(ageMs)) return 'block';
  if (ageMs <= WARN_MS) return 'fresh';
  if (ageMs <= BLOCK_MS) return 'warn';
  return 'block';
}
