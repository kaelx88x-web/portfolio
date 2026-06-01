import { describe, it, expect } from 'vitest';
import {
  extractTickers,
  extractMoneyValues,
  canonicalTicker,
  matchesKnownNumber,
  checkDataIntegrity,
  fromAiContext,
} from './data-integrity';
import { KNOWN, GOOD_RESPONSE_TEXT, HALLUCINATED_RESPONSE_TEXT } from './fixtures';

describe('Section 1 — extractTickers', () => {
  it('finds market-prefixed, suffixed, OCC option and bare symbols', () => {
    const t = extractTickers('Holding US.SCHG, 0005.HK, NIO260530C00005500 and AAPL.');
    expect(t).toContain('US.SCHG');
    expect(t).toContain('0005.HK');
    expect(t).toContain('NIO260530C00005500');
    expect(t).toContain('AAPL');
  });

  it('ignores domain vocabulary (jargon all-caps) via the stoplist', () => {
    const t = extractTickers('Your P/L and YTD return in USD are fine; the AI agrees. DTE is low.');
    expect(t).not.toContain('USD');
    expect(t).not.toContain('YTD');
    expect(t).not.toContain('AI');
    expect(t).not.toContain('DTE');
  });
});

describe('Section 1 — extractMoneyValues', () => {
  it('parses $, negative, comma-grouped and currency-suffixed figures', () => {
    const v = extractMoneyValues('Value $1,719.50, loss -$81.00, NIO at 5.44 USD.');
    expect(v).toContain(1719.5);
    expect(v).toContain(81);
    expect(v).toContain(5.44);
  });
});

describe('Section 1 — canonicalTicker', () => {
  it('reconciles the same security across formats', () => {
    expect(canonicalTicker('HK.00005')).toBe(canonicalTicker('0005.HK'));
    expect(canonicalTicker('US.SCHG')).toBe('US:SCHG');
    expect(canonicalTicker('AAPL')).toBe('US:AAPL');
  });

  it('maps an OCC option to its underlying', () => {
    expect(canonicalTicker('NIO260530C00005500')).toBe('US:NIO');
  });
});

describe('Section 1 — matchesKnownNumber', () => {
  it('matches within tolerance and rejects invented values', () => {
    expect(matchesKnownNumber(1719.5, KNOWN)).toBe(true);
    expect(matchesKnownNumber(1719.51, KNOWN)).toBe(true); // rounding tolerance
    expect(matchesKnownNumber(9999, KNOWN)).toBe(false);
  });

  it('always accepts zero', () => {
    expect(matchesKnownNumber(0, KNOWN)).toBe(true);
  });
});

describe('Section 1 — checkDataIntegrity', () => {
  it('passes a grounded response', () => {
    const r = checkDataIntegrity({ id: 'g', surface: 'test', text: GOOD_RESPONSE_TEXT }, KNOWN);
    expect(r.passed).toBe(true);
    expect(r.score).toBe(100);
    expect(r.hallucinatedTickers).toHaveLength(0);
  });

  it('hard-fails invented tickers and prices', () => {
    const r = checkDataIntegrity({ id: 'h', surface: 'test', text: HALLUCINATED_RESPONSE_TEXT }, KNOWN);
    expect(r.passed).toBe(false);
    expect(r.hallucinatedTickers).toEqual(expect.arrayContaining(['TSLA', 'GOOG']));
    expect(r.unverifiedMoneyValues).toContain(9999);
    expect(r.score).toBeLessThan(50);
  });
});

describe('Section 1 — fromAiContext', () => {
  it('builds ground truth from a context payload', () => {
    const known = fromAiContext({
      metadata: { baseCurrency: 'USD' },
      portfolio: {
        value: 1719.5,
        cashBalance: 1372.57,
        holdings: [{ symbol: 'US.SCHG', marketPrice: 90.3, marketValue: 175.76, unrealizedPnl: 5 }],
      },
      benchmark: { benchmark: 'SPY' },
    });
    expect(known.allowedTickers).toEqual(expect.arrayContaining(['US.SCHG', 'SPY', 'USD']));
    expect(known.knownNumbers).toEqual(expect.arrayContaining([1719.5, 1372.57, 90.3, 175.76]));
    expect(known.cashBalance).toBe(1372.57);
  });
});
