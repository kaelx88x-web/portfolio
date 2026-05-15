import { getDemoUser } from '$lib/server/demo-user';
import { getCashBalance, getHoldings, snapshotToHoldings } from '$lib/services/portfolio.service';
import { syncMoomoo } from '$lib/services/broker.service';
import { getLatestSnapshot, takeSnapshot } from '$lib/services/snapshot.service';
import type { SnapshotHolding } from '$lib/types/portfolio';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const user = await getDemoUser();
  const snapshot = await getLatestSnapshot(user.id);

  if (snapshot) {
    let rows: SnapshotHolding[] = [];
    try { rows = JSON.parse(snapshot.holdingsJson); } catch { rows = []; }
    const totalValue = rows.reduce((sum, h) => sum + h.marketValue, 0);
    return {
      holdings: snapshotToHoldings(rows, totalValue),
      cashBalance: snapshot.cashBalance,
      dataSource: 'snapshot' as const,
      snapshotDate: snapshot.snapshotDate.toISOString()
    };
  }

  const [holdings, cashBalance] = await Promise.all([getHoldings(user.id), getCashBalance(user.id)]);
  return { holdings, cashBalance, dataSource: 'transactions' as const, snapshotDate: null };
};

export const actions: Actions = {
  refreshPrices: async () => {
    const user = await getDemoUser();
    try {
      const result = await syncMoomoo();
      await takeSnapshot(user.id, result.holdings, result.account_info?.cash ?? 0);
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
