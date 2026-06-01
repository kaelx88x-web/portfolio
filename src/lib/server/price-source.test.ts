import { describe, it, expect } from 'vitest';
import { toMoomooCode } from './price-source';

describe('toMoomooCode', () => {
  it('prefixes a bare US symbol', () => {
    expect(toMoomooCode('AAPL', 'US')).toBe('US.AAPL');
  });

  it('leaves an already US-prefixed symbol unchanged (no double prefix)', () => {
    expect(toMoomooCode('US.SPYT', 'US')).toBe('US.SPYT');
  });

  it('leaves an already HK-prefixed symbol unchanged', () => {
    expect(toMoomooCode('HK.00005', 'HK')).toBe('HK.00005');
  });

  it('pads a bare HK numeric symbol to 5 digits', () => {
    expect(toMoomooCode('700', 'HK')).toBe('HK.00700');
  });

  it('strips a trailing .HK and pads', () => {
    expect(toMoomooCode('5.HK', 'HK')).toBe('HK.00005');
  });

  it('keeps SH/SZ prefixed symbols verbatim', () => {
    expect(toMoomooCode('SH.600000', 'CN')).toBe('SH.600000');
    expect(toMoomooCode('SZ.000001', 'CN')).toBe('SZ.000001');
  });

  it('uppercases and trims', () => {
    expect(toMoomooCode('  aapl ', 'US')).toBe('US.AAPL');
  });

  it('returns null for unsupported markets (e.g. MY)', () => {
    expect(toMoomooCode('MAYBANK', 'MY')).toBeNull();
  });
});
