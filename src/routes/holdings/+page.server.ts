import { getCashBalance, getHoldings, snapshotToHoldings } from '$lib/services/portfolio.service';
import { syncMoomoo, getCapitalFlow } from '$lib/services/broker.service';
import { getLatestSnapshot, takeSnapshot } from '$lib/services/snapshot.service';
import { prisma } from '$lib/server/db';
import type { SnapshotHolding } from '$lib/types/portfolio';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { activeBrokerAccId: true } }).catch(() => null);
  const activeBrokerAccId = dbUser?.activeBrokerAccId ?? null;
  const snapshot = await getLatestSnapshot(user.id, activeBrokerAccId);

  let holdings;
  let cashBalance;
  let dataSource: 'snapshot' | 'transactions';
  let snapshotDate: string | null;

  if (snapshot) {
    let rows: SnapshotHolding[] = [];
    try { rows = JSON.parse(snapshot.holdingsJson); } catch { rows = []; }
    const totalValue = rows.reduce((sum, h) => sum + h.marketValue, 0);
    holdings = snapshotToHoldings(rows, totalValue);
    cashBalance = snapshot.cashBalance;
    dataSource = 'snapshot';
    snapshotDate = snapshot.snapshotDate.toISOString();
  } else {
    [holdings, cashBalance] = await Promise.all([getHoldings(user.id), getCashBalance(user.id)]);
    dataSource = 'transactions';
    snapshotDate = null;
  }

  const symbols = holdings
    .map((h: { symbol: string }) => h.symbol)
    .filter((s: string) => /^(US|HK)\.[A-Z]{1,6}$/.test(s));
  const capitalFlow = await getCapitalFlow(symbols);
  const flowMap = Object.fromEntries(capitalFlow.map((f) => [f.code, f]));

  return { holdings, cashBalance, dataSource, snapshotDate, flowMap };
};

export const actions: Actions = {
  refreshPrices: async ({ locals }) => {
    const user = locals.user!;
    try {
      const dbU = await prisma.user.findUnique({ where: { id: user.id }, select: { activeBrokerAccId: true } }).catch(() => null);
      const accId = dbU?.activeBrokerAccId ?? undefined;
      const result = await syncMoomoo(undefined, accId);
      await takeSnapshot(user.id, result.holdings, result.account_info?.cash ?? 0, result.account_info?.total_assets || undefined, accId);
      return {
        refreshResult: {
          updated: result.holdings_count,
          failed: 0,
          skipped: 0,
          refreshedAt: new Date().toISOString()
        }
      };
    } catch {
      return {
        refreshResult: {
          updated: 0,
          failed: 1,
          skipped: 0,
          refreshedAt: new Date().toISOString()
        }
      };
    }
  }
};
