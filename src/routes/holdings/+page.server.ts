import { getDemoUser } from '$lib/server/demo-user';
import { getCashBalance, getHoldings, snapshotToHoldings } from '$lib/services/portfolio.service';
import { refreshHoldingPrices } from '$lib/services/market-price.service';
import { getLatestSnapshot } from '$lib/services/snapshot.service';
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
    const result = await refreshHoldingPrices(user.id);
    return { refreshResult: result };
  }
};
