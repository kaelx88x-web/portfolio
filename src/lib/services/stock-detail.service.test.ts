import { describe, it, expect } from 'vitest';
import { toMoomooCode, expiryDte } from './stock-detail.service';

describe('toMoomooCode', () => {
  it('US ticker → US. prefix', () => {
    expect(toMoomooCode('nvda', 'US')).toBe('US.NVDA');
    expect(toMoomooCode('AAPL', null)).toBe('US.AAPL'); // default US
  });
  it('HK numeric → HK. zero-padded to 5', () => {
    expect(toMoomooCode('700', 'HK')).toBe('HK.00700');
    expect(toMoomooCode('5', 'HK')).toBe('HK.00005');
  });
  it('MY numeric → MY. zero-padded to 4', () => {
    expect(toMoomooCode('1023', 'MY')).toBe('MY.1023');
    expect(toMoomooCode('23', 'MY')).toBe('MY.0023');
  });
  it('China A → SH/SZ by leading digit', () => {
    expect(toMoomooCode('600519', 'CN')).toBe('SH.600519');
    expect(toMoomooCode('000001', 'CN')).toBe('SZ.000001');
  });
  it('already-prefixed code passes through', () => {
    expect(toMoomooCode('HK.00700', 'HK')).toBe('HK.00700');
    expect(toMoomooCode('US.NVDA', 'US')).toBe('US.NVDA');
  });
});

describe('expiryDte', () => {
  it('counts whole days to expiry', () => {
    expect(expiryDte('2026-07-02', new Date('2026-06-02T00:00:00Z'))).toBe(30);
  });
  it('today → 0', () => {
    expect(expiryDte('2026-06-02', new Date('2026-06-02T12:00:00Z'))).toBe(0);
  });
});
