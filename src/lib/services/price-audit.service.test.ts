import { describe, it, expect, vi } from 'vitest';
const create = vi.hoisted(() => vi.fn(async (args: { data: unknown }) => ({ id: 'a1', ...(args.data as object) })));
vi.mock('$lib/server/db', () => ({ prisma: { priceAuditLog: { create } } }));
import { recordPriceAudit } from './price-audit.service';

describe('recordPriceAudit', () => {
  it('derives status from age and persists the snapshot', async () => {
    const now = 1_000_000;
    await recordPriceAudit({ userId: 'u1', context: 'paper', symbol: 'US.NVDA', source: 'yahoo', price: 100, bid: 99, ask: 101, quoteTs: now - 90_000 }, now);
    const arg = create.mock.calls[0][0].data;
    expect(arg).toMatchObject({ userId: 'u1', context: 'paper', symbol: 'US.NVDA', source: 'yahoo', price: 100, ageMs: 90_000, status: 'stale' });
  });
});
