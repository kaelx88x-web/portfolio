import { describe, it, expect } from 'vitest';
import { money, uniformCurrency } from './format';

describe('money', () => {
  it('defaults to USD when no currency is given', () => {
    expect(money(1234.5)).toBe('$1,234.50');
  });

  it('formats USD with the dollar sign', () => {
    expect(money(1719.99, 'USD')).toBe('$1,719.99');
  });

  it('formats HKD with the HK$ symbol (not a bare $)', () => {
    const out = money(638440, 'HKD');
    expect(out).toContain('HK$');
    expect(out).toContain('638,440.00');
  });

  it('accepts lower-cased currency codes', () => {
    expect(money(100, 'usd')).toBe('$100.00');
  });

  it('always shows two fraction digits', () => {
    expect(money(5)).toBe('$5.00');
  });

  it('formats negative values', () => {
    expect(money(-715, 'HKD')).toContain('715.00');
    expect(money(-715, 'HKD')).toContain('-');
  });

  it('falls back to USD formatting for an invalid currency code', () => {
    expect(money(50, 'NOTACURRENCY')).toBe('$50.00');
  });

  it('falls back to USD when currency is an empty string', () => {
    expect(money(50, '')).toBe('$50.00');
  });

  it('treats NaN/0-ish values as 0', () => {
    expect(money(0)).toBe('$0.00');
  });
});

describe('uniformCurrency', () => {
  it('returns the shared currency when all holdings agree', () => {
    expect(uniformCurrency(['HKD', 'HKD', 'HKD'])).toBe('HKD');
  });

  it('returns the fallback when currencies are mixed', () => {
    expect(uniformCurrency(['HKD', 'USD'], 'USD')).toBe('USD');
  });

  it('ignores null/undefined/empty entries', () => {
    expect(uniformCurrency(['HKD', null, undefined, ''])).toBe('HKD');
  });

  it('falls back to USD when the list is empty', () => {
    expect(uniformCurrency([])).toBe('USD');
  });

  it('uses the provided fallback when currencies are mixed', () => {
    expect(uniformCurrency(['HKD', 'JPY'], 'SGD')).toBe('SGD');
  });

  it('normalises case', () => {
    expect(uniformCurrency(['hkd', 'HKD'])).toBe('HKD');
  });
});
