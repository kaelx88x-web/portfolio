import { calculateAllocationByAssetType, calculateAllocationBySymbol } from '$lib/calculators/allocation';
import { calculateAverageCost, calculateCurrentQuantity } from '$lib/calculators/average-cost';
import {
  calculateTodayChange,
  calculateTotalCostBasis,
  calculateTotalGainLoss
} from '$lib/calculators/performance';
import { prisma } from '$lib/server/db';
import type { DashboardSummary, Holding, TransactionWithRelations } from '$lib/types/portfolio';

export async function getHoldings(userId: string): Promise<Holding[]> {
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      assetId: { not: null },
      type: { in: ['buy', 'sell'] }
    },
    include: {
      account: true,
      asset: true
    },
    orderBy: { tradeDate: 'asc' }
  });

  const grouped = new Map<string, TransactionWithRelations[]>();
  for (const transaction of transactions) {
    if (!transaction.asset) continue;
    const key = `${transaction.accountId}:${transaction.assetId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), transaction as TransactionWithRelations]);
  }

  const holdings = [...grouped.values()]
    .map((items) => {
      const first = items[0];
      const asset = first.asset;
      if (!asset) return null;

      const quantity = calculateCurrentQuantity(items);
      const averageCost = calculateAverageCost(items);
      const marketPrice = asset.latestPrice || averageCost;
      const marketValue = quantity * marketPrice;
      const costBasis = quantity * averageCost;

      return {
        accountId: first.accountId,
        accountName: first.account.name,
        assetId: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        assetType: asset.assetType,
        currency: asset.currency,
        quantity,
        averageCost,
        marketPrice,
        marketValue,
        costBasis,
        unrealizedPnl: marketValue - costBasis,
        allocationPercentage: 0
      };
    })
    .filter((holding): holding is Holding => holding !== null && holding.quantity > 0.0000001);

  const totalValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0);

  return holdings
    .map((holding) => ({
      ...holding,
      allocationPercentage: totalValue > 0 ? (holding.marketValue / totalValue) * 100 : 0
    }))
    .sort((a, b) => b.marketValue - a.marketValue);
}

export async function getCashBalance(userId: string) {
  const transactions = await prisma.transaction.findMany({ where: { userId } });

  return transactions.reduce((cash, transaction) => {
    if (transaction.type === 'deposit') return cash + transaction.price;
    if (transaction.type === 'withdrawal') return cash - transaction.price - transaction.fee;
    if (transaction.type === 'buy') return cash - transaction.quantity * transaction.price - transaction.fee;
    if (transaction.type === 'sell') return cash + transaction.quantity * transaction.price - transaction.fee;
    if (transaction.type === 'dividend') return cash + transaction.quantity * transaction.price - transaction.fee;
    if (transaction.type === 'fee') return cash - transaction.fee - transaction.price;
    return cash;
  }, 0);
}

export async function getDashboard(userId: string) {
  const [holdings, accounts, recentTransactions, watchlists, cashBalance] = await Promise.all([
    getHoldings(userId),
    prisma.account.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
    prisma.transaction.findMany({
      where: { userId },
      include: { account: true, asset: true },
      orderBy: { tradeDate: 'desc' },
      take: 6
    }),
    prisma.watchlist.findMany({
      where: { userId },
      include: { items: { include: { asset: true }, orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'asc' }
    }),
    getCashBalance(userId)
  ]);

  const totalPortfolioValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0);
  const summary: DashboardSummary = {
    totalPortfolioValue,
    totalGainLoss: calculateTotalGainLoss(holdings),
    totalCostBasis: calculateTotalCostBasis(holdings),
    cashBalance,
    todayChange: calculateTodayChange(holdings)
  };

  return {
    summary,
    accounts,
    holdings,
    topHoldings: holdings.slice(0, 5),
    allocationBySymbol: calculateAllocationBySymbol(holdings),
    allocationByAssetType: calculateAllocationByAssetType(holdings),
    recentTransactions,
    watchlists
  };
}
