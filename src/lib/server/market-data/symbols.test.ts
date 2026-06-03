import { describe, it, expect } from 'vitest';
import { toYahooSymbol } from './symbols';

describe('toYahooSymbol', () => {
  it('passes through plain US tickers', () => {
    expect(toYahooSymbol('NVDA')).toBe('NVDA');
    expect(toYahooSymbol('US.NVDA')).toBe('NVDA');
  });
  it('maps HK to zero-padded .HK', () => {
    expect(toYahooSymbol('HK.00700')).toBe('0700.HK');
    expect(toYahooSymbol('HK.700')).toBe('0700.HK');
  });
  it('maps Shanghai to .SS and Shenzhen to .SZ', () => {
    expect(toYahooSymbol('SH.600519')).toBe('600519.SS');
    expect(toYahooSymbol('SZ.000001')).toBe('000001.SZ');
  });
  it('uppercases and trims', () => {
    expect(toYahooSymbol('  us.aapl ')).toBe('AAPL');
  });
});
