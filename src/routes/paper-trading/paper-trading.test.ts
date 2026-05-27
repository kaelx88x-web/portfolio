import { describe, it, expect } from 'vitest';

function toMoomooSymbol(sym: string): string {
  const s = sym.trim().toUpperCase();
  if (/^(US\.|HK\.|SH\.|SZ\.)/.test(s)) return s;
  return `US.${s}`;
}

describe('toMoomooSymbol', () => {
  it('prepends US. to bare symbols', () => {
    expect(toMoomooSymbol('AAPL')).toBe('US.AAPL');
  });
  it('preserves existing market prefix', () => {
    expect(toMoomooSymbol('HK.700')).toBe('HK.700');
    expect(toMoomooSymbol('US.TSLA')).toBe('US.TSLA');
  });
  it('uppercases the symbol', () => {
    expect(toMoomooSymbol('aapl')).toBe('US.AAPL');
  });
});
