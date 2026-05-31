import { getHoldings, snapshotToHoldings } from '$lib/services/portfolio.service';
import { listAccounts } from '$lib/services/account.service';
import { getLatestSnapshot, takeSnapshot } from '$lib/services/snapshot.service';
import { syncMoomoo } from '$lib/services/broker.service';
import { syncDealsToTransactions } from '$lib/services/deal-sync.service';
import { calcCapitalAndRealized } from '$lib/calculators/realized-pnl';
import { refreshHoldingPrices } from '$lib/services/market-price.service';
import type { AllocationSlice, Holding, SnapshotHolding } from '$lib/types/portfolio';
import { prisma } from '$lib/server/db';
import type { Actions, PageServerLoad } from './$types';
import { randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { assembleBriefing, generateBriefHeadline } from '$lib/services/briefing.service';

export const actions: Actions = {
  dismissOnboarding: async ({ locals }) => {
    await prisma.user.update({
      where: { id: locals.user!.id },
      data: { onboardingCompleted: true },
    });
    return { dismissed: true };
  },

  refreshPrices: async ({ locals }) => {
    const user = locals.user!;
    try {
      const result = await refreshHoldingPrices(user.id);
      return { pricesRefreshed: true, ...result };
    } catch (e) {
      return { pricesRefreshed: false, error: e instanceof Error ? e.message : 'Price refresh failed' };
    }
  },

  refresh: async ({ locals }) => {
    const user = locals.user!;
    try {
      const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { activeBrokerAccId: true } }).catch((err) => {
        console.warn('[dashboard/refresh] Failed to fetch activeBrokerAccId from DB:', (err as Error).message);
        return null;
      });
      const result = await syncMoomoo(true, dbUser?.activeBrokerAccId ?? undefined);
      const accounts = await listAccounts(user.id);
      const account = accounts[0];
      await takeSnapshot(user.id, result.holdings, result.account_info?.cash ?? 0, result.account_info?.total_assets || undefined);
      // Fire deal sync in background — don't block the UI refresh
      if (account && result.deals.length > 0) {
        syncDealsToTransactions(user.id, account.id, result.deals)
          .then((r) => console.log(`[deal-sync] inserted=${r.inserted} skipped=${r.skipped}`))
          .catch((err) => console.error('[deal-sync] error:', err));
      }
      return { refreshed: true, updatedAt: new Date().toISOString(), count: result.holdings_count };
    } catch (e) {
      return { refreshed: false, error: e instanceof Error ? e.message : 'Sync failed' };
    }
  },

  generateBrief: async ({ locals }) => {
    const user = locals.user!;

    // Re-fetch snapshot for latest data
    const snapshot = await getLatestSnapshot(user.id).catch(() => null);
    let snapshotRows: SnapshotHolding[] = [];
    let totalValue = 0;
    if (snapshot) {
      try { snapshotRows = JSON.parse(snapshot.holdingsJson); } catch { snapshotRows = []; }
      totalValue = snapshot.totalValue;
    }

    // If no snapshot data, nothing meaningful to brief on — return early
    if (snapshotRows.length === 0) {
      return { briefGenerated: false };
    }

    // Minimal allocation map for headline context
    const sectorMap = new Map<string, number>();
    for (const h of snapshotRows) {
      const sector = (h.sector ?? h.assetType ?? 'Other') as string;
      sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + Math.abs(h.marketValue));
    }
    const allocationBase = [...sectorMap.values()].reduce((s, v) => s + v, 0);
    const allocations = [...sectorMap.entries()]
      .map(([label, value]) => ({
        label,
        value,
        percentage: allocationBase > 0 ? (value / allocationBase) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    // Day P&L from snapshot rows
    const dayPl = snapshotRows.length > 0
      ? snapshotRows.reduce((s, h) => s + (h.todayPl ?? 0), 0)
      : null;

    // Compute total return for health score
    // Note: uses unrealized P&L only (realized+dividends not re-fetched in action context).
    // Health score here is approximate; load() uses the full return including realized P&L.
    const unrealisedPnl = snapshotRows.reduce((s, h) => s + h.unrealizedPnl, 0);
    const costBasisTotal = snapshotRows.reduce((s, h) => s + (h.marketValue - h.unrealizedPnl), 0);
    const totalReturnPct = costBasisTotal > 0 ? (unrealisedPnl / costBasisTotal) * 100 : 0;

    const briefing = assembleBriefing({
      snapshotRows,
      totalValue,
      totalReturnPct,
      dayPl,
      allocations,
      aiHeadline: null,         // not needed — we're generating it
      headlineGeneratedAt: null,
    });

    const headline = await generateBriefHeadline(
      {
        totalValue,
        healthScore: briefing.healthScore,
        healthLabel: briefing.healthLabel,
        dayPl: briefing.dayPl,
        topSectorLabel: allocations[0]?.label ?? 'Portfolio',
        topSectorPct: allocations[0]?.percentage ?? 0,
        alerts: briefing.alerts,
      },
      env.ANTHROPIC_API_KEY,
      env.AI_PROVIDER_CLAUDE_ENABLED === 'true',
    );

    // Save to ai_insights table (upsert-style: insert fresh row)
    const id = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60_000); // 24 hours

    try {
      await prisma.$executeRaw`
        INSERT INTO ai_insights
          (id, userId, insightType, title, summary, riskLevel, contentJson, expiresAt, metadataJson, createdAt, updatedAt)
        VALUES (
          ${id}, ${user.id}, ${'portfolio_health'}, ${'Daily Brief'},
          ${headline}, ${'moderate'},
          ${JSON.stringify({ brief: headline })},
          ${expiresAt},
          ${JSON.stringify({ version: '1.0', type: 'daily_brief' })},
          ${now}, ${now}
        )
      `;
    } catch (err) {
      console.error('[generateBrief] failed to save brief to DB:', err);
      return { briefGenerated: false };
    }

    return { briefGenerated: true };
  },
};

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;

  const [accounts, transactionHoldings, snapshot, watchlists, allTransactions] = await Promise.all([
    listAccounts(user.id),
    getHoldings(user.id),
    getLatestSnapshot(user.id),
    prisma.watchlist.findMany({
      where: { userId: user.id },
      include: { items: { include: { asset: true }, orderBy: { createdAt: 'desc' }, take: 6 } },
      take: 1,
    }).catch(() => []),
    prisma.transaction.findMany({
      where: { userId: user.id },
      select: { type: true, quantity: true, price: true, fee: true, assetId: true },
      orderBy: { tradeDate: 'asc' },
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

  let holdings: Holding[] = transactionHoldings;
  let totalValue = holdings.reduce((s, h) => s + h.marketValue, 0);
  let totalPnl = totalValue - holdings.reduce((s, h) => s + h.costBasis, 0);
  let dataSource: 'snapshot' | 'transactions' = 'transactions';
  let snapshotDate: string | null = null;
  let snapshotRows: SnapshotHolding[] = [];

  if (snapshot) {
    try {
      snapshotRows = JSON.parse(snapshot.holdingsJson);
    } catch {
      snapshotRows = [];
    }

    const holdingsValue = snapshotRows.reduce((s, h) => s + h.marketValue, 0);
    holdings = snapshotToHoldings(snapshotRows, holdingsValue);
    totalValue = snapshot.totalValue;
    totalPnl = snapshotRows.reduce((s, h) => s + h.unrealizedPnl, 0);
    dataSource = 'snapshot';
    snapshotDate = snapshot.snapshotDate.toISOString();
  }

  // Realized P&L + dividends + net invested capital — computed from full transaction history
  const { netInvested, realizedPnl, dividends } = calcCapitalAndRealized(allTransactions);

  // Total Return = unrealized P&L + realized P&L + dividends
  const totalReturn = totalPnl + realizedPnl + dividends;

  // Use cost basis of current holdings as denominator (more meaningful than total deposits,
  // which includes uninvested cash sitting on the side).
  const costBasisTotal = holdings.reduce((s, h) => s + h.costBasis, 0);
  const returnBase = costBasisTotal > 0 ? costBasisTotal : netInvested;
  const totalReturnPct = returnBase > 0 ? (totalReturn / returnBase) * 100 : 0;

  // Day P&L — broker's todayPl per holding, summed. null when no broker snapshot.
  const dayPl = dataSource === 'snapshot'
    ? snapshotRows.reduce((s, h) => s + (h.todayPl ?? 0), 0)
    : null;

  // Allocation by sector, falling back to asset type for broker snapshots.
  const sectorMap = new Map<string, number>();
  for (const h of holdings) {
    const sector = h.sector ?? h.assetType ?? 'Other';
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + Math.abs(h.marketValue));
  }
  const allocationBase = [...sectorMap.values()].reduce((s, value) => s + value, 0);
  const allocations: AllocationSlice[] = [...sectorMap.entries()]
    .map(([label, value]) => ({
      label,
      value,
      percentage: allocationBase > 0 ? (value / allocationBase) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // Top 8 holdings by market value
  const topHoldings = [...holdings].sort((a, b) => b.marketValue - a.marketValue).slice(0, 8);

  // Allocation by individual stock/ETF symbol
  const holdingAllocations: AllocationSlice[] = topHoldings.map((h) => ({
    label: h.symbol,
    value: Math.abs(h.marketValue),
    percentage: totalValue > 0 ? (Math.abs(h.marketValue) / totalValue) * 100 : 0,
  }));

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

  // Onboarding checklist data
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { onboardingCompleted: true, activeBrokerAccId: true },
  }).catch(() => null);
  const onboardingCompleted = dbUser?.onboardingCompleted ?? false;
  const activeBrokerAccId = dbUser?.activeBrokerAccId ?? null;
  const hasCash = (snapshot?.cashBalance ?? 0) > 0 || accounts.some((a) => (a.cashBalance ?? 0) > 0);
  const hasBroker = accounts.some(a => a.brokerName !== 'paper');

  // Auto-complete onboarding once user has set cash balance
  const autoCompleteOnboarding = !onboardingCompleted && hasCash;
  if (autoCompleteOnboarding) {
    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingCompleted: true },
    }).catch(() => {});
  }

  // Brief headline — latest AI-generated brief (stored with title = 'Daily Brief')
  const briefInsight = await prisma.aiInsight
    .findFirst({
      where: { userId: user.id, title: 'Daily Brief' },
      orderBy: { createdAt: 'desc' },
      select: { summary: true, createdAt: true },
    })
    .catch(() => null);

  const briefing = assembleBriefing({
    snapshotRows,
    totalValue,
    totalReturnPct,
    dayPl,
    allocations,
    aiHeadline: briefInsight?.summary ?? null,
    headlineGeneratedAt: briefInsight?.createdAt?.toISOString() ?? null,
  });

  return {
    totalValue,
    totalPnl,
    totalReturn,
    totalReturnPct,
    costBasisTotal,
    realizedPnl,
    dividends,
    netInvested,
    dayPl,
    accounts,
    allocations,
    holdingAllocations,
    topHoldings,
    growthData,
    briefing,
    watchlistItems,
    snapshot,
    dataSource,
    snapshotDate,
    onboarding: {
      show: !(onboardingCompleted || autoCompleteOnboarding),
      hasCash,
      hasBroker,
      onboardingCompleted: onboardingCompleted || autoCompleteOnboarding,
    },
    activeBrokerAccId,
  };
}
