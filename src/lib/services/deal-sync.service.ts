// src/lib/services/deal-sync.service.ts

import { prisma } from '$lib/server/db';
import type { MoomooDealItem } from '$lib/types/portfolio';

function stripBrokerPrefix(code: string): string {
  // Takes the longest dot-separated segment.
  // Invariant: the ticker/OCC symbol is always longer than the market code (e.g. 'US', 'HK').
  // Works for both prefix ('US.PATH' → 'PATH') and suffix ('NIO260530C00005500.US' → 'NIO260530C00005500').
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

  // 2. Filter to only new deals; skipped counts only duplicate deal IDs (not malformed timestamps)
  const nonDuplicates = deals.filter((d) => !existingIds.has(d.deal_id));
  const skipped = deals.length - nonDuplicates.length;
  const newDeals = nonDuplicates.filter((d) => !isNaN(new Date(d.create_time).getTime()));

  if (newDeals.length === 0) return { inserted: 0, skipped };

  // 3. Deduplicate tickers and upsert all needed assets in one pass (avoids N+1)
  const uniqueTickers = [...new Set(newDeals.map((d) => stripBrokerPrefix(d.code)))];
  const assetMap = new Map<string, string>(); // ticker → assetId
  for (const ticker of uniqueTickers) {
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
    assetMap.set(ticker, asset.id);
  }

  // 4. Insert new transactions
  let inserted = 0;
  for (const deal of newDeals) {
    const ticker = stripBrokerPrefix(deal.code);
    const assetId = assetMap.get(ticker)!;
    const tradeDate = new Date(deal.create_time);

    await prisma.transaction.create({
      data: {
        userId,
        accountId,
        assetId,
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

  return { inserted, skipped };
}
