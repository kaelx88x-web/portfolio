import { getHoldings, snapshotToHoldings } from '$lib/services/portfolio.service';
import { getLatestSnapshot } from '$lib/services/snapshot.service';
import { prisma } from '$lib/server/db';
import type { SnapshotHolding } from '$lib/types/portfolio';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;
  // Scope to the broker account selected in the topbar (mirrors the dashboard);
  // otherwise the latest snapshot across all accounts would be shown.
  const dbUser = await prisma.user
    .findUnique({ where: { id: user.id }, select: { activeBrokerAccId: true } })
    .catch(() => null);
  const activeBrokerAccId = dbUser?.activeBrokerAccId ?? null;

  const [snapshot, transactionHoldings] = await Promise.all([
    getLatestSnapshot(user.id, activeBrokerAccId),
    getHoldings(user.id),
  ]);

  if (snapshot) {
    let rows: SnapshotHolding[] = [];
    try { rows = JSON.parse(snapshot.holdingsJson); } catch { rows = []; }
    const securitiesValue = rows.reduce((s, h) => s + h.marketValue, 0);
    const cashBalance = snapshot.cashBalance ?? 0;
    return {
      holdings: snapshotToHoldings(rows, securitiesValue),
      dataSource: 'snapshot' as const,
      snapshotDate: snapshot.snapshotDate.toISOString(),
      // Account total assets (securities + cash) — matches the topbar total.
      totalAssets: snapshot.totalValue,
      cashBalance,
    };
  }

  const securitiesValue = transactionHoldings.reduce((s, h) => s + h.marketValue, 0);
  return {
    holdings: transactionHoldings,
    dataSource: 'transactions' as const,
    snapshotDate: null,
    totalAssets: securitiesValue,
    cashBalance: 0,
  };
}
