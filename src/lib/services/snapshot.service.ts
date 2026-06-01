import { prisma } from '$lib/server/db';
import type { BrokerHolding, Holding, SnapshotHolding } from '$lib/types/portfolio';

async function upsertSnapshot(data: {
  userId: string;
  brokerAccId: string | null;
  snapshotDate: Date;
  totalValue: number;
  cashBalance: number;
  holdingsCount: number;
  holdingsJson: string;
  allocationJson: string;
}) {
  const { userId, brokerAccId, snapshotDate, ...rest } = data;

  if (brokerAccId) {
    await prisma.portfolioSnapshot.upsert({
      where: { userId_brokerAccId_snapshotDate: { userId, brokerAccId, snapshotDate } },
      create: { userId, brokerAccId, snapshotDate, ...rest },
      update: rest,
    });
  } else {
    // Nullable brokerAccId — Prisma compound unique doesn't accept null; use findFirst+upsert
    const existing = await prisma.portfolioSnapshot.findFirst({
      where: { userId, brokerAccId: null, snapshotDate },
      select: { id: true },
    });
    if (existing) {
      await prisma.portfolioSnapshot.update({ where: { id: existing.id }, data: rest });
    } else {
      await prisma.portfolioSnapshot.create({ data: { userId, brokerAccId: null, snapshotDate, ...rest } });
    }
  }
}

export async function takeSnapshot(
  userId: string,
  holdings: BrokerHolding[],
  cashBalance: number,
  totalValueOverride?: number,
  brokerAccId?: string
): Promise<void> {
  const snapshotDate = new Date();
  snapshotDate.setUTCHours(0, 0, 0, 0);

  const holdingsSum = holdings.reduce((sum, h) => sum + h.market_value, 0);
  const totalValue = totalValueOverride ?? (holdingsSum + cashBalance);

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

  await upsertSnapshot({
    userId,
    brokerAccId: brokerAccId ?? null,
    snapshotDate,
    totalValue,
    cashBalance,
    holdingsCount: holdings.length,
    holdingsJson: JSON.stringify(holdingRows),
    allocationJson: JSON.stringify(allocationBySymbol),
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

  await upsertSnapshot({
    userId,
    brokerAccId: null,
    snapshotDate: datedSnapshot,
    totalValue,
    cashBalance,
    holdingsCount: holdingRows.length,
    holdingsJson: JSON.stringify(holdingRows),
    allocationJson: JSON.stringify(allocationBySymbol),
  });
}

export async function listSnapshots(userId: string, brokerAccId?: string | null, limit = 30) {
  return prisma.portfolioSnapshot.findMany({
    where: { userId, brokerAccId: brokerAccId ?? null },
    orderBy: { snapshotDate: 'desc' },
    take: limit
  });
}

export async function getLatestSnapshot(userId: string, brokerAccId?: string | null) {
  return prisma.portfolioSnapshot.findFirst({
    where: { userId, brokerAccId: brokerAccId ?? null },
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
