/** Map an app/moomoo code (e.g. "US.NVDA", "HK.00700") to a Yahoo ticker. */
export function toYahooSymbol(code: string): string {
  const raw = String(code ?? '').trim().toUpperCase();
  const dot = raw.indexOf('.');
  if (dot === -1) return raw; // already a plain Yahoo ticker

  const market = raw.slice(0, dot);
  const rest = raw.slice(dot + 1);
  switch (market) {
    case 'US':
      return rest;
    case 'HK':
      return `${String(parseInt(rest.replace(/\D/g, ''), 10)).padStart(4, '0')}.HK`;
    case 'SH':
      return `${rest}.SS`;
    case 'SZ':
      return `${rest}.SZ`;
    default:
      return rest; // unknown prefix: best-effort bare symbol
  }
}
