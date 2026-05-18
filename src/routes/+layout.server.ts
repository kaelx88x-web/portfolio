import { getDemoUser } from '$lib/server/demo-user';
import { listAccounts } from '$lib/services/account.service';
import { getLatestSnapshot } from '$lib/services/snapshot.service';
import type { LayoutServerLoad } from './$types';
import type { SnapshotHolding } from '$lib/types/portfolio';

export const load: LayoutServerLoad = async ({ setHeaders }) => {
  setHeaders({ 'cache-control': 'private, max-age=60' });
  try {
    const user = await getDemoUser();
    const [snapshot, accounts] = await Promise.all([
      getLatestSnapshot(user.id),
      listAccounts(user.id)
    ]);

    let totalValue = 0;
    let dayPl = 0;

    if (snapshot) {
      totalValue = snapshot.totalValue;
      try {
        const rows: SnapshotHolding[] = JSON.parse(snapshot.holdingsJson);
        dayPl = rows.reduce((s, h) => s + (h.todayPl ?? 0), 0);
      } catch { /* ignore */ }
    }

    const accountName = accounts[0]?.name ?? 'Portfolio';
    const yesterdayValue = totalValue - dayPl;
    const dayChangePct = yesterdayValue > 0 ? (dayPl / yesterdayValue) * 100 : 0;

    return { portfolioSummary: { totalValue, dayPl, dayChangePct, accountName } };
  } catch {
    return { portfolioSummary: { totalValue: 0, dayPl: 0, dayChangePct: 0, accountName: 'Portfolio' } };
  }
}
