import { getDemoUser } from '$lib/server/demo-user';
import { getHoldings } from '$lib/services/portfolio.service';
import { listAccounts } from '$lib/services/account.service';
import { getLatestSnapshot } from '$lib/services/snapshot.service';
import type { AllocationSlice } from '$lib/types/portfolio';
import { prisma } from '$lib/server/db';

export async function load() {
  const user = await getDemoUser();

  const [accounts, holdings, snapshot, watchlists] = await Promise.all([
    listAccounts(user.id),
    getHoldings(user.id),
    getLatestSnapshot(user.id),
    prisma.watchlist.findMany({
      where: { userId: user.id },
      include: { items: { include: { asset: true }, orderBy: { createdAt: 'desc' }, take: 6 } },
      take: 1,
    }).catch(() => []),
  ]);

  // Flatten watchlist items
  const watchlistItems = watchlists.flatMap((wl) =>
    wl.items.map((item) => ({
      id: item.id,
      symbol: item.asset.symbol,
      name: item.asset.name,
      notes: item.notes ?? undefined,
    }))
  ).slice(0, 6);

  // Build portfolio value from holdings
  const totalValue = holdings.reduce((s, h) => s + h.marketValue, 0);
  const totalCost  = holdings.reduce((s, h) => s + h.costBasis, 0);
  const totalPnl   = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  // Allocation by sector
  const sectorMap = new Map<string, number>();
  for (const h of holdings) {
    const sector = h.sector ?? 'Other';
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + h.marketValue);
  }
  const allocations: AllocationSlice[] = [...sectorMap.entries()]
    .map(([label, value]) => ({
      label,
      value,
      percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // Top 8 holdings by market value
  const topHoldings = [...holdings].sort((a, b) => b.marketValue - a.marketValue).slice(0, 8);

  // Snapshots for growth chart (ordered by snapshotDate asc)
  const snapshots = await prisma.portfolioSnapshot.findMany({
    where: { userId: user.id },
    orderBy: { snapshotDate: 'asc' },
    select: { snapshotDate: true, totalValue: true },
    take: 365,
  }).catch(() => []);

  const growthData = snapshots.map((s) => ({
    date: s.snapshotDate.toISOString(),
    totalValue: s.totalValue,
  }));

  // Latest AI brief — use `summary` field from AiInsight
  const latestInsight = await prisma.aiInsight.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { summary: true },
  }).catch(() => null);

  const aiBrief = latestInsight?.summary?.slice(0, 300) ?? '';

  return {
    totalValue,
    totalPnl,
    totalPnlPct,
    accounts,
    allocations,
    topHoldings,
    growthData,
    aiBrief,
    watchlistItems,
    snapshot,
  };
}
