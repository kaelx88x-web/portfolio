// src/routes/api/trades/validate/freshness.test.ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('$lib/services/trade-layer.service', () => ({
  parseTradeOrderType: (x: unknown) => x, parseTradeTicketType: (x: unknown) => x,
  validateTradeTicket: vi.fn(async () => ({ ok: true, warnings: [] }))
}));
vi.mock('$lib/services/price-audit.service', () => ({ recordPriceAudit: vi.fn(async () => ({})) }));
import { POST } from './+server';

function post(quoteTs: number) {
  return { request: { json: async () => ({ symbol: 'US.NVDA', side: 'buy', quantity: 1, quote: { price: 100, bid: null, ask: null, ts: quoteTs, source: 'yahoo' } }) }, locals: { user: { id: 'u1' } } } as never;
}

describe('validate freshness gate', () => {
  it('blocks when the quote is older than 5min', async () => {
    const res = await POST(post(Date.now() - 6 * 60_000));
    const body = await res.json();
    expect(body.validation.freshness).toBe('block');
    expect(body.validation.ok).toBe(false);
  });
  it('passes a fresh quote through', async () => {
    const res = await POST(post(Date.now()));
    const body = await res.json();
    expect(body.validation.freshness).toBe('fresh');
  });
});
