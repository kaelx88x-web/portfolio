import { prisma } from '$lib/server/db';
import { assessQuoteFreshness } from '$lib/trading/freshness';

export interface PriceAuditInput {
  userId: string;
  context: 'trade' | 'order' | 'paper';
  symbol: string;
  source: string;
  price: number | null;
  bid: number | null;
  ask: number | null;
  quoteTs: number; // epoch ms
}

/** Persist the price the user acted on, classifying freshness as live/stale/delayed. */
export async function recordPriceAudit(input: PriceAuditInput, now = Date.now()) {
  const ageMs = Math.max(0, now - input.quoteTs);
  const f = assessQuoteFreshness(ageMs);
  const status = f === 'fresh' ? 'live' : f === 'warn' ? 'stale' : 'delayed';
  return prisma.priceAuditLog.create({
    data: {
      userId: input.userId, context: input.context, symbol: input.symbol, source: input.source,
      price: input.price, bid: input.bid, ask: input.ask,
      quoteTs: new Date(input.quoteTs), ageMs, status
    }
  });
}
