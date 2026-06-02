const PREFIXES = ['US.', 'HK.', 'SH.', 'SZ.', 'SG.', 'MY.'];

/** Map a UI symbol + market to a moomoo code with correct prefix and padding. */
export function toMoomooCode(symbol: string, market?: string | null): string {
  const raw = String(symbol ?? '').trim().toUpperCase();
  if (PREFIXES.some((p) => raw.startsWith(p))) return raw;

  const m = (market ?? 'US').trim().toUpperCase();
  const digits = raw.replace(/\D/g, '');

  switch (m) {
    case 'HK':
      return `HK.${digits.padStart(5, '0')}`;
    case 'MY':
    case 'MYS':
      return `MY.${digits.padStart(4, '0')}`;
    case 'CN':
    case 'A':
      // Shanghai listings are the 6-series (60xxxx/688xxx); everything else
      // (Shenzhen main 00xxxx, ChiNext 30xxxx) routes to Shenzhen.
      return `${digits.startsWith('6') ? 'SH' : 'SZ'}.${digits.padStart(6, '0')}`;
    case 'SG':
      return `SG.${raw}`;
    case 'US':
    default:
      return `US.${raw}`;
  }
}

/** Whole days from `today` (UTC date) to an expiry 'YYYY-MM-DD'. */
export function expiryDte(expiry: string, today: Date = new Date()): number {
  const e = new Date(`${expiry}T00:00:00Z`).getTime();
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((e - t) / 86_400_000);
}
