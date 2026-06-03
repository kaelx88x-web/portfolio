import { describe, it, expect } from 'vitest';
import { computeLiveTotal } from './portfolio-live';

describe('computeLiveTotal', () => {
  const holdings = [{ code: 'US.NVDA', qty: 2, fallbackPrice: 100 }, { code: 'US.AAPL', qty: 1, fallbackPrice: 50 }];
  it('uses live prices when present', () => {
    const quotes = new Map([['US.NVDA', { last: 120 } as never]]);
    expect(computeLiveTotal(holdings, quotes)).toBe(290); // 2*120 + 1*50
  });
  it('falls back when no live price', () => {
    expect(computeLiveTotal(holdings, new Map())).toBe(250);
  });
});
