import { prisma } from '$lib/server/db';
import type { BrokerHolding, Holding, SnapshotHolding } from '$lib/types/portfolio';

export async function takeSnapshot(
  userId: string,
  holdings: BrokerHolding[],
  cashBalance: number
): Promise<void> {
  const snapshotDate = new Date();
  snapshotDate.setUTCHours(0, 0, 0, 0);

  const totalValue = holdings.reduce((sum, h) => sum + h.market_value, 0) + cashBalance;

  const holdingRows: SnapshotHolding[] = holdings.map((h) => ({
    accountName: 'Moomoo',
    brokerName: 'Moomoo',
    symbol: h.symbol,
    name: h.name ?? '',
    assetType: h.asset_type ?? 'stock',
    sector: null,
    country: null,
    quantity: h.quantity,
    averageCost: h.average_cost,
    marketPrice: h.market_price,
    marketValue: h.market_value,
    unrealizedPnl: h.unrealized_pl,
    todayPl: h.today_pl ?? 0,
    currency: h.currency ?? 'USD'
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

export async function takeSnapshotFromHoldings(
  userId: string,
  holdings: Holding[],
  cashBalance: number,
  snapshotDate = new Date()
): Promise<void> {
  if (holdings.length === 0 && cashBalance <= 0) {
    throw new Error('Refusing to write an empty zero-value portfolio snapshot.');
  }

  const datedSnapshot = new Date(snapshotDate);
  datedSnapshot.setUTCHours(0, 0, 0, 0);

  const totalValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0) + cashBalance;
  const holdingRows: SnapshotHolding[] = holdings.map((holding) => ({
    accountName: holding.accountName,
    brokerName: holding.accountName,
    symbol: holding.symbol,
    name: holding.name,
    assetType: holding.assetType,
    sector: holding.sector,
    country: holding.country,
    quantity: holding.quantity,
    averageCost: holding.averageCost,
    marketPrice: holding.marketPrice,
    marketValue: holding.marketValue,
    unrealizedPnl: holding.unrealizedPnl,
    todayPl: 0,
    currency: holding.currency
  }));

  const allocationBySymbol: Record<string, number> = {};
  for (const holding of holdingRows) {
    allocationBySymbol[holding.symbol] =
      totalValue > 0 ? Math.round((holding.marketValue / totalValue) * 10000) / 100 : 0;
  }

  await prisma.portfolioSnapshot.upsert({
    where: { userId_snapshotDate: { userId, snapshotDate: datedSnapshot } },
    create: {
      userId,
      snapshotDate: datedSnapshot,
      totalValue,
      cashBalance,
      holdingsCount: holdingRows.length,
      holdingsJson: JSON.stringify(holdingRows),
      allocationJson: JSON.stringify(allocationBySymbol)
    },
    update: {
      totalValue,
      cashBalance,
      holdingsCount: holdingRows.length,
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
