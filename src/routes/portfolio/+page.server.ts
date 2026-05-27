import { getHoldings, snapshotToHoldings } from '$lib/services/portfolio.service';
import { getLatestSnapshot } from '$lib/services/snapshot.service';
import type { SnapshotHolding } from '$lib/types/portfolio';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;
  const [snapshot, transactionHoldings] = await Promise.all([
    getLatestSnapshot(user.id),
    getHoldings(user.id),
  ]);

  if (snapshot) {
    let rows: SnapshotHolding[] = [];
    try { rows = JSON.parse(snapshot.holdingsJson); } catch { rows = []; }
    const totalValue = rows.reduce((s, h) => s + h.marketValue, 0);
    return {
      holdings: snapshotToHoldings(rows, totalValue),
      dataSource: 'snapshot' as const,
      snapshotDate: snapshot.snapshotDate.toISOString(),
    };
  }

  return {
    holdings: transactionHoldings,
    dataSource: 'transactions' as const,
    snapshotDate: null,
  };
}
