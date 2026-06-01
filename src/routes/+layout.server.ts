// src/routes/+layout.server.ts
import { listAccounts } from '$lib/services/account.service';
import { getLatestSnapshot } from '$lib/services/snapshot.service';
import { prisma } from '$lib/server/db';
import type { LayoutServerLoad } from './$types';
import type { SnapshotHolding } from '$lib/types/portfolio';
import { uniformCurrency } from '$lib/format';

export const load: LayoutServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return { user: null, portfolioSummary: { totalValue: 0, dayPl: 0, dayChangePct: 0, accountName: 'Portfolio', accountMode: 'LIVE' as const, activeBrokerAccId: null, currency: 'USD' } };
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { activeBrokerAccId: true },
    }).catch(() => null);
    const activeBrokerAccId = dbUser?.activeBrokerAccId ?? null;

    const [snapshot, accounts] = await Promise.all([
      getLatestSnapshot(user.id, activeBrokerAccId),
      listAccounts(user.id),
    ]);

    const activeAccount = (activeBrokerAccId
      ? accounts.find(a => a.brokerAccId === activeBrokerAccId)
      : null) ?? accounts[0];

    let totalValue = 0;
    let dayPl = 0;
    let holdingCurrencies: (string | null | undefined)[] = [];

    if (snapshot) {
      totalValue = snapshot.totalValue;
      try {
        const rows: SnapshotHolding[] = JSON.parse(snapshot.holdingsJson);
        dayPl = rows.reduce((s, h) => s + (h.todayPl ?? 0), 0);
        holdingCurrencies = rows.map((h) => h.currency);
      } catch { /* ignore */ }
    }

    const accountName = activeAccount?.name ?? 'Portfolio';
    const accountMode = activeAccount?.accountType === 'live' ? 'LIVE' as const : 'SANDBOX' as const;
    // Prefer the snapshot holdings' shared currency; broker account base currency
    // may be a stale 'USD' default.
    const currency = uniformCurrency(holdingCurrencies, activeAccount?.currency ?? 'USD');
    const yesterdayValue = totalValue - dayPl;
    const dayChangePct = yesterdayValue > 0 ? (dayPl / yesterdayValue) * 100 : 0;

    return {
      user,
      session: locals.session,
      portfolioSummary: { totalValue, dayPl, dayChangePct, accountName, accountMode, activeBrokerAccId, currency },
    };
  } catch {
    return {
      user,
      session: locals.session,
      portfolioSummary: { totalValue: 0, dayPl: 0, dayChangePct: 0, accountName: 'Portfolio', accountMode: 'LIVE' as const, activeBrokerAccId: null, currency: 'USD' },
    };
  }
};
