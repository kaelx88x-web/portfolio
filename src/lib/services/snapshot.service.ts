import { prisma } from '$lib/server/db';
import type { BrokerHolding, SnapshotHolding } from '$lib/types/portfolio';

export async function takeSnapshot(
  userId: string,
  holdings: BrokerHolding[],
  cashBalance: number
): Promise<void> {
  const snapshotDate = new Date();
  snapshotDate.setUTCHours(0, 0, 0, 0);

  const totalValue = holdings.reduce((sum, h) => sum + h.market_value, 0) + cashBalance;

  const holdingRows: SnapshotHolding[] = holdings.map((h) => ({
    symbol: h.symbol,
    quantity: h.quantity,
    averageCost: h.average_cost,
    marketPrice: h.market_price,
    marketValue: h.market_value,
    unrealizedPnl: h.unrealized_pl
  }));

  const allocationBySymbol: Record<string, number> = {};
  for (const h of holdingRows) {
    allocationBySymbol[h.symbol] =
      totalValue > 0 ? Math.round((h.marketValue / totalValue) * 10000) / 100 : 0;
  }

  await prisma.portfolioSnapshot.upsert({
    where: { userId_snapshotDate: { userId, snapshotDate } },
    create: {
      userId,
      snapshotDate,
      totalValue,
      cashBalance,
      holdingsCount: holdings.length,
      holdingsJson: JSON.stringify(holdingRows),
      allocationJson: JSON.stringify(allocationBySymbol)
    },
    update: {
      totalValue,
      cashBalance,
      holdingsCount: holdings.length,
      holdingsJson: JSON.stringify(holdingRows),
      allocationJson: JSON.stringify(allocationBySymbol)
    }
  });
}

export async function listSnapshots(userId: string, limit = 30) {
  return prisma.portfolioSnapshot.findMany({
    where: { userId },
    orderBy: { snapshotDate: 'desc' },
    take: limit
  });
}

export async function getLatestSnapshot(userId: string) {
  return prisma.portfolioSnapshot.findFirst({
    where: { userId },
    orderBy: { snapshotDate: 'desc' }
  });
}

export async function writeSyncLog(
  userId: string,
  status: 'success' | 'failed',
  recordCount: number,
  errorMessage?: string
): Promise<void> {
  await prisma.brokerSyncLog.create({
    data: { userId, broker: 'moomoo', status, recordCount, errorMessage }
  });
}
