// src/lib/services/deal-sync.service.ts

import { prisma } from '$lib/server/db';
import type { MoomooDealItem } from '$lib/types/portfolio';

function stripBrokerPrefix(code: string): string {
  // 'US.PATH' → 'PATH'   (prefix format — moomoo bridge)
  // 'NIO260530C00005500.US' → 'NIO260530C00005500'  (suffix format — legacy)
  const parts = code.split('.');
  return parts.reduce((a, b) => (a.length >= b.length ? a : b)).toUpperCase();
}

export async function syncDealsToTransactions(
  userId: string,
  accountId: string,
  deals: MoomooDealItem[],
): Promise<{ inserted: number; skipped: number }> {
  if (deals.length === 0) return { inserted: 0, skipped: 0 };

  // 1. Fetch deal IDs already stored for this user so we can skip duplicates
  const existing = await prisma.transaction.findMany({
    where: { userId, brokerDealId: { not: null } },
    select: { brokerDealId: true },
  });
  const existingIds = new Set(existing.map((r) => r.brokerDealId!));

  // 2. Filter to only new deals
  const newDeals = deals.filter((d) => !existingIds.has(d.deal_id));

  let inserted = 0;
  for (const deal of newDeals) {
    // Guard against malformed timestamps from the bridge
    const tradeDate = new Date(deal.create_time);
    if (isNaN(tradeDate.getTime())) continue;

    const ticker = stripBrokerPrefix(deal.code);

    // Upsert Asset (find or create by symbol)
    const asset = await prisma.asset.upsert({
      where: { symbol: ticker },
      update: {},
      create: {
        symbol: ticker,
        name: ticker,
        assetType: 'STOCK',
        currency: 'USD',
      },
    });

    await prisma.transaction.create({
      data: {
        userId,
        accountId,
        assetId: asset.id,
        brokerDealId: deal.deal_id,
        type: deal.side.toLowerCase(), // 'buy' | 'sell' — matches calcCapitalAndRealized
        tradeDate,
        quantity: deal.qty,
        price: deal.price,
        fee: deal.fee ?? 0,
        currency: 'USD',
        notes: `Synced from moomoo deal ${deal.deal_id}`,
      },
    });
    inserted++;
  }

  return { inserted, skipped: deals.length - newDeals.length };
}
