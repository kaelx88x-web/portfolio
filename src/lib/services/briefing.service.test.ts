import { describe, it, expect } from 'vitest';
import { parseOptionsFromSnapshot } from './briefing.service';
import type { SnapshotHolding } from '$lib/types/portfolio';

function makeHolding(symbol: string, overrides: Partial<SnapshotHolding> = {}): SnapshotHolding {
  return {
    symbol,
    name: symbol,
    assetType: 'OPTION',
    quantity: -1,
    averageCost: 100,
    marketPrice: 50,
    marketValue: -50,
    unrealizedPnl: 50,
    todayPl: 0,
    currency: 'USD',
    ...overrides,
  };
}

describe('parseOptionsFromSnapshot', () => {
  it('parses suffix-format OCC symbol: NIO260530C00005500.US', () => {
    const result = parseOptionsFromSnapshot([makeHolding('NIO260530C00005500.US')]);
    expect(result).toHaveLength(1);
    expect(result[0].underlying).toBe('NIO');
    expect(result[0].optionType).toBe('call');
    expect(result[0].strike).toBe(5.5);
  });

  it('parses prefix-format moomoo symbol: US.PATH260529P10000', () => {
    const result = parseOptionsFromSnapshot([makeHolding('US.PATH260529P10000')]);
    expect(result).toHaveLength(1);
    expect(result[0].underlying).toBe('PATH');
    expect(result[0].optionType).toBe('put');
    expect(result[0].strike).toBe(10);
  });

  it('returns empty for plain stock symbol', () => {
    const result = parseOptionsFromSnapshot([makeHolding('AAPL')]);
    expect(result).toHaveLength(0);
  });

  it('returns empty for stock with suffix: AAPL.US', () => {
    const result = parseOptionsFromSnapshot([makeHolding('AAPL.US')]);
    expect(result).toHaveLength(0);
  });
});
