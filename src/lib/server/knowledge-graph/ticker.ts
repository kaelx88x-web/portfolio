// Shared ticker canonicalization for the knowledge graph. Persisted CompanyNode.ticker
// uses moomoo code form (e.g. "US.NVDA"); the page-load must canonicalize held symbols
// the same way so user scoping matches.

const OPTION_RE = /\d{6}[CP]\d+$/i;

export function toMoomooCode(symbol: string): string {
  const s = (symbol || '').trim().toUpperCase();
  if (/^(US|HK|SH|SZ|SG|MY|CN)\./.test(s)) return s;
  const suffix = s.match(/^(.+)\.(HK|KL|SS|SZ|SI)$/);
  if (suffix) {
    const mk = { HK: 'HK', KL: 'MY', SS: 'SH', SZ: 'SZ', SI: 'SG' }[suffix[2]] ?? suffix[2];
    let code = suffix[1];
    if (mk === 'HK' && /^\d+$/.test(code)) code = code.padStart(5, '0');
    return `${mk}.${code}`;
  }
  return `US.${s}`;
}

export function isOption(symbol: string): boolean {
  return OPTION_RE.test(symbol.split('.').pop() ?? '');
}
