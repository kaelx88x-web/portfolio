import { randomUUID } from 'node:crypto';
import { prisma } from '$lib/server/db';
import { getCashBalance, getHoldings } from '$lib/services/portfolio.service';
import type { AllocationSlice, Holding, SnapshotHolding } from '$lib/types/portfolio';

export const PORTFOLIO_METRIC_PERIODS = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', 'MAX'] as const;
export type PortfolioMetricPeriod = (typeof PORTFOLIO_METRIC_PERIODS)[number];

type SnapshotRow = {
  id: string;
  snapshotDate: Date;
  totalValue: number;
  cashBalance: number;
  holdingsCount: number;
  holdingsJson: string;
  allocationJson: string;
};

type TransactionRow = {
  accountId: string;
  assetId: string | null;
  type: string;
  quantity: number;
  price: number;
  fee: number;
  currency: string;
  tradeDate: Date;
};

type ExternalFlows = {
  inflow: number;
  outflow: number;
  net: number;
};

export type PortfolioMetricSummary = {
  status: 'ready' | 'insufficient_data';
  message: string;
  snapshotDate: string | null;
  portfolioValue: number;
  cashValue: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  realizedPnl: number;
  dividendIncome: number;
  feesPaid: number;
  totalReturn: number;
  totalReturnPercent: number;
  dailyReturn: number;
  weeklyReturn: number;
  monthlyReturn: number;
  ytdReturn: number;
  currency: string;
  holdingsCount: number;
  dataSource: 'snapshot' | 'transactions';
};

export type PortfolioHistoryPoint = {
  date: string;
  portfolioValue: number;
  cashValue: number;
  marketValue: number;
  netDeposit: number;
  dailyReturn: number;
  cumulativeReturn: number;
  changeValue: number;
  changePercent: number;
};

export type PortfolioMetricsDashboard = {
  summary: PortfolioMetricSummary;
  allocation: {
    bySymbol: AllocationSlice[];
    byAssetType: AllocationSlice[];
    byBroker: AllocationSlice[];
    byCurrency: AllocationSlice[];
  };
  history: PortfolioHistoryPoint[];
  cache: {
    cacheKey: string;
    generatedAt: string;
    expiresAt: string;
  };
};

export async function getPortfolioMetricsDashboard(
  userId: string,
  period: PortfolioMetricPeriod = 'MAX',
  forceRefresh = false
): Promise<PortfolioMetricsDashboard> {
  const cacheKey = `phase3a:v2:portfolio_metrics:${userId}:${period}`;
  if (!forceRefresh) {
    const cached = await readPortfolioMetricsCache(cacheKey);
    if (cached) return cached;
  }

  const [snapshots, transactions, user] = await Promise.all([
    prisma.portfolioSnapshot.findMany({
      where: { userId },
      orderBy: { snapshotDate: 'asc' }
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { tradeDate: 'asc' }
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { baseCurrency: true } })
  ]);

  const filteredSnapshots = filterSnapshotsByPeriod(snapshots, period);
  const latestSnapshot = filteredSnapshots.at(-1) ?? snapshots.at(-1) ?? null;
  const firstSnapshot = filteredSnapshots[0] ?? latestSnapshot;
  const previousSnapshot = filteredSnapshots.length > 1 ? (filteredSnapshots.at(-2) ?? null) : null;
  const holdings = latestSnapshot ? snapshotHoldings(latestSnapshot) : await currentHoldings(userId);
  const cashValue = latestSnapshot?.cashBalance ?? (await getCashBalance(userId));
  const portfolioValue =
    latestSnapshot?.totalValue ?? holdings.reduce((sum, holding) => sum + holding.marketValue, 0) + cashValue;
  const marketValue = Math.max(portfolioValue - cashValue, 0);
  const costBasis = holdings.reduce((sum, holding) => sum + holding.costBasis, 0);
  const unrealizedPnl = holdings.reduce((sum, holding) => sum + holding.unrealizedPnl, 0);
  const realized = realizedPnl(transactions);
  const income = incomeAndFees(transactions);
  const netDeposit = netExternalContribution(transactions, latestSnapshot?.snapshotDate ?? new Date(), portfolioValue);
  const periodFlows = externalFlows(transactions, firstSnapshot?.snapshotDate ?? null, latestSnapshot?.snapshotDate ?? null);
  const totalReturn =
    netDeposit > 0 ? portfolioValue - netDeposit : unrealizedPnl + realized + income.dividendIncome - income.feesPaid;

  const history = buildHistory(filteredSnapshots, transactions);
  const dashboard: PortfolioMetricsDashboard = {
    summary: {
      status: filteredSnapshots.length >= 1 || holdings.length > 0 || cashValue > 0 ? 'ready' : 'insufficient_data',
      message:
        filteredSnapshots.length >= 2
          ? 'Portfolio metrics calculated from portfolio snapshots.'
          : filteredSnapshots.length === 1
            ? 'Latest metrics are ready. Add another snapshot to calculate daily and period returns.'
            : 'Create a portfolio snapshot or add transactions to calculate portfolio metrics.',
      snapshotDate: latestSnapshot ? isoDate(latestSnapshot.snapshotDate) : null,
      portfolioValue,
      cashValue,
      marketValue,
      costBasis,
      unrealizedPnl,
      unrealizedPnlPercent: percentage(unrealizedPnl, costBasis),
      realizedPnl: realized,
      dividendIncome: income.dividendIncome,
      feesPaid: income.feesPaid,
      totalReturn,
      totalReturnPercent:
        period === 'MAX' && netDeposit > 0
          ? percentage(totalReturn, netDeposit)
          : flowAdjustedReturnPct(firstSnapshot?.totalValue ?? 0, portfolioValue, periodFlows),
      dailyReturn: previousSnapshot
        ? flowAdjustedReturnPct(
            previousSnapshot.totalValue,
            portfolioValue,
            externalFlows(transactions, previousSnapshot.snapshotDate, latestSnapshot?.snapshotDate ?? null)
          )
        : 0,
      weeklyReturn: returnFromBoundary(filteredSnapshots, latestSnapshot, daysAgo(latestSnapshot?.snapshotDate, 7), transactions),
      monthlyReturn: returnFromBoundary(filteredSnapshots, latestSnapshot, startOfMonth(latestSnapshot?.snapshotDate), transactions),
      ytdReturn: returnFromBoundary(filteredSnapshots, latestSnapshot, startOfYear(latestSnapshot?.snapshotDate), transactions),
      currency: user?.baseCurrency ?? holdings[0]?.currency ?? 'USD',
      holdingsCount: holdings.length,
      dataSource: latestSnapshot ? 'snapshot' : 'transactions'
    },
    allocation: {
      bySymbol: groupAllocation(holdings, (holding) => holding.symbol),
      byAssetType: groupAllocation(holdings, (holding) => holding.assetType || 'Unknown'),
      byBroker: groupAllocation(holdings, (holding) => holding.accountName || 'Manual'),
      byCurrency: groupAllocation(holdings, (holding) => holding.currency || 'USD')
    },
    history,
    cache: {
      cacheKey,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString()
    }
  };

  await writePortfolioMetricsArtifacts(userId, cacheKey, dashboard);
  return dashboard;
}

export async function refreshPortfolioMetrics(userId: string, period: PortfolioMetricPeriod = 'MAX') {
  const [holdings, cashBalance] = await Promise.all([getHoldings(userId), getCashBalance(userId)]);
  if (holdings.length > 0 || cashBalance > 0) {
    const { takeSnapshotFromHoldings } = await import('$lib/services/snapshot.service');
    await takeSnapshotFromHoldings(userId, holdings, cashBalance);
  }

  return getPortfolioMetricsDashboard(userId, period, true);
}

function filterSnapshotsByPeriod(snapshots: SnapshotRow[], period: PortfolioMetricPeriod) {
  if (period === 'MAX' || snapshots.length === 0) return snapshots;
  const latest = snapshots.at(-1);
  if (!latest) return snapshots;
  const start =
    period === 'YTD'
      ? new Date(Date.UTC(latest.snapshotDate.getUTCFullYear(), 0, 1))
      : daysAgo(latest.snapshotDate, { '1D': 1, '1W': 7, '1M': 31, '3M': 92, '6M': 183, '1Y': 365 }[period]);
  if (!start) return snapshots;
  return snapshots.filter((snapshot) => snapshot.snapshotDate >= start);
}

function snapshotHoldings(snapshot: SnapshotRow): Holding[] {
  const rows = parseHoldings(snapshot.holdingsJson);
  return rows.map((holding) => ({
    accountId: holding.accountName ?? 'snapshot',
    accountName: holding.accountName ?? holding.brokerName ?? 'Snapshot',
    assetId: holding.symbol,
    symbol: holding.symbol,
    name: holding.name || holding.symbol,
    assetType: holding.assetType || 'stock',
    sector: holding.sector ?? null,
    country: holding.country ?? null,
    currency: holding.currency || 'USD',
    quantity: holding.quantity,
    averageCost: holding.averageCost,
    marketPrice: holding.marketPrice,
    marketValue: holding.marketValue,
    costBasis: holding.quantity * holding.averageCost,
    unrealizedPnl: holding.unrealizedPnl,
    allocationPercentage: percentage(holding.marketValue, snapshot.totalValue)
  }));
}

async function currentHoldings(userId: string) {
  return getHoldings(userId);
}

function parseHoldings(json: string | undefined): SnapshotHolding[] {
  try {
    const rows = JSON.parse(json ?? '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function buildHistory(snapshots: SnapshotRow[], transactions: TransactionRow[]): PortfolioHistoryPoint[] {
  return snapshots.map((snapshot, index) => {
    const previous = snapshots[index - 1] ?? null;
    const netDeposit = netExternalContribution(transactions, snapshot.snapshotDate, snapshot.totalValue);
    const flows = previous ? externalFlows(transactions, previous.snapshotDate, snapshot.snapshotDate) : { inflow: 0, outflow: 0, net: 0 };
    const compatibleFlows = previous
      ? compatibleExternalFlows(previous.totalValue, snapshot.totalValue, flows).flows
      : flows;
    const changeValue = previous ? snapshot.totalValue - previous.totalValue - compatibleFlows.net : 0;

    return {
      date: isoDate(snapshot.snapshotDate),
      portfolioValue: snapshot.totalValue,
      cashValue: snapshot.cashBalance,
      marketValue: Math.max(snapshot.totalValue - snapshot.cashBalance, 0),
      netDeposit,
      dailyReturn: previous ? flowAdjustedReturnPct(previous.totalValue, snapshot.totalValue, flows) : 0,
      cumulativeReturn: netDeposit > 0 ? percentage(snapshot.totalValue - netDeposit, netDeposit) : 0,
      changeValue,
      changePercent: previous ? flowAdjustedReturnPct(previous.totalValue, snapshot.totalValue, flows) : 0
    };
  });
}

function realizedPnl(transactions: TransactionRow[]) {
  const positions = new Map<string, { quantity: number; cost: number }>();
  let realized = 0;

  for (const transaction of transactions) {
    if (!transaction.assetId || !['buy', 'sell'].includes(transaction.type)) continue;
    const position = positions.get(transaction.assetId) ?? { quantity: 0, cost: 0 };
    if (transaction.type === 'buy') {
      position.quantity += transaction.quantity;
      position.cost += transaction.quantity * transaction.price + transaction.fee;
    } else if (position.quantity > 0) {
      const sellQuantity = Math.min(transaction.quantity, position.quantity);
      const averageCost = position.cost / position.quantity;
      realized += sellQuantity * transaction.price - transaction.fee - sellQuantity * averageCost;
      position.quantity -= sellQuantity;
      position.cost -= sellQuantity * averageCost;
    }
    positions.set(transaction.assetId, position);
  }

  return realized;
}

function incomeAndFees(transactions: TransactionRow[]) {
  return transactions.reduce(
    (totals, transaction) => {
      totals.feesPaid += Math.max(transaction.fee, 0);
      if (transaction.type === 'fee') totals.feesPaid += Math.max(transaction.price, 0);
      if (['dividend', 'interest'].includes(transaction.type)) {
        totals.dividendIncome += Math.max(transaction.quantity * transaction.price - transaction.fee, 0);
      }
      return totals;
    },
    { dividendIncome: 0, feesPaid: 0 }
  );
}

function groupAllocation(holdings: Holding[], key: (holding: Holding) => string): AllocationSlice[] {
  const values = new Map<string, number>();
  for (const holding of holdings) {
    const label = key(holding) || 'Unknown';
    values.set(label, (values.get(label) ?? 0) + Math.max(holding.marketValue, 0));
  }
  return slicesFromValues(values);
}

function slicesFromValues(values: Map<string, number>): AllocationSlice[] {
  const total = [...values.values()].reduce((sum, value) => sum + Math.max(value, 0), 0);
  return [...values.entries()]
    .map(([label, value]) => ({
      label,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0
    }))
    .sort((a, b) => b.value - a.value);
}

function returnFromBoundary(
  snapshots: SnapshotRow[],
  latest: SnapshotRow | null,
  boundary: Date | null,
  transactions: TransactionRow[]
) {
  if (!latest || !boundary) return 0;
  const first = snapshots.find((snapshot) => snapshot.snapshotDate >= boundary) ?? snapshots[0];
  if (!first || first.id === latest.id) return 0;
  return flowAdjustedReturnPct(
    first.totalValue,
    latest.totalValue,
    externalFlows(transactions, first.snapshotDate, latest.snapshotDate)
  );
}

function externalFlows(transactions: TransactionRow[], startExclusive: Date | null, endInclusive: Date | null): ExternalFlows {
  const rows = transactions.filter((transaction) => {
    if (!endInclusive || transaction.tradeDate > endInclusive) return false;
    if (startExclusive && transaction.tradeDate <= startExclusive) return false;
    return ['deposit', 'withdrawal'].includes(transaction.type);
  });
  const inflow = rows
    .filter((transaction) => transaction.type === 'deposit')
    .reduce((sum, transaction) => sum + Math.max(transaction.price - transaction.fee, 0), 0);
  const outflow = rows
    .filter((transaction) => transaction.type === 'withdrawal')
    .reduce((sum, transaction) => sum + Math.max(transaction.price + transaction.fee, 0), 0);

  return { inflow, outflow, net: inflow - outflow };
}

function netExternalContribution(transactions: TransactionRow[], endInclusive: Date, portfolioValue: number) {
  return compatibleExternalFlows(0, portfolioValue, externalFlows(transactions, null, endInclusive)).flows.net;
}

function flowAdjustedReturnPct(startValue: number, endValue: number, flows: ExternalFlows) {
  const compatibleFlows = compatibleExternalFlows(startValue, endValue, flows);
  if (!compatibleFlows.compatible) {
    return returnPct(startValue, endValue);
  }

  const denominator = startValue + compatibleFlows.flows.inflow;
  if (denominator <= 0) return 0;
  return ((endValue - startValue - compatibleFlows.flows.net) / denominator) * 100;
}

function returnPct(startValue: number, endValue: number) {
  if (startValue <= 0) return 0;
  return ((endValue - startValue) / startValue) * 100;
}

function compatibleExternalFlows(startValue: number, endValue: number, flows: ExternalFlows) {
  const grossFlow = Math.abs(flows.inflow) + Math.abs(flows.outflow);
  if (grossFlow <= 0) return { compatible: true, flows };

  const referenceValue = Math.max(Math.abs(startValue), Math.abs(endValue), 1);
  const flowDominatesSnapshot = grossFlow > referenceValue * 10;
  const largeDepositMissingFromSnapshot = flows.inflow > referenceValue * 5 && endValue < flows.inflow * 0.5;

  if (flowDominatesSnapshot || largeDepositMissingFromSnapshot) {
    return {
      compatible: false,
      flows: { inflow: 0, outflow: 0, net: 0 }
    };
  }

  return { compatible: true, flows };
}

function startOfMonth(date: Date | undefined) {
  if (!date) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfYear(date: Date | undefined) {
  if (!date) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

function daysAgo(date: Date | undefined, days: number) {
  if (!date) return null;
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() - days);
  return value;
}

function percentage(value: number, total: number) {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

async function readPortfolioMetricsCache(cacheKey: string): Promise<PortfolioMetricsDashboard | null> {
  try {
    const row = await prisma.analyticsCache.findUnique({ where: { cacheKey } });
    if (!row || row.expiresAt <= new Date()) return null;
    return JSON.parse(row.payloadJson) as PortfolioMetricsDashboard;
  } catch {
    return null;
  }
}

async function writePortfolioMetricsArtifacts(userId: string, cacheKey: string, dashboard: PortfolioMetricsDashboard) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60_000);

  try {
    await prisma.analyticsCache.upsert({
      where: { cacheKey },
      create: {
        id: randomUUID(),
        userId,
        cacheKey,
        cacheType: 'phase3a_portfolio_metrics',
        payloadJson: JSON.stringify(dashboard),
        generatedAt: now,
        expiresAt
      },
      update: {
        payloadJson: JSON.stringify(dashboard),
        generatedAt: now,
        expiresAt
      }
    });
  } catch {
    // Cache is optional; portfolio metrics should still render while migrations are pending.
  }
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
