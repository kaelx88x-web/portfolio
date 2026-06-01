// src/lib/services/cashflow-sync.service.ts
//
// Persists external capital flows (deposits / withdrawals) from the broker's
// cash-flow feed into the Transaction table as 'deposit' / 'withdrawal' rows.
// analytics.service then folds these into netContribution + flow-adjusted
// returns automatically — so returns stop treating deposits as "gains".
//
// CRITICAL: a broker cash-flow feed mixes EVERYTHING (trade settlements, option
// premiums, FX conversions, dividends, fund moves, coupons, assignments). Only
// genuine bank-transfer deposits/withdrawals are capital contributions; counting
// the rest would corrupt netContribution. We therefore match the cashflow_type
// conservatively by keyword and ignore anything ambiguous (e.g. "Others",
// "Currency Exchange", "Fund Dividend", "Coupon", "… from Assign").

import { prisma } from '$lib/server/db';
import type { CashFlowItem } from '$lib/services/broker.service';

export type ContributionType = 'deposit' | 'withdrawal';

/**
 * Classifies a cash-flow row as an external capital contribution, or null when
 * it is trading/income/FX activity that must NOT count toward netContribution.
 */
export function classifyContribution(item: CashFlowItem): ContributionType | null {
  const type = (item.cashflow_type || '').toLowerCase();
  // Exclude flows that look like deposits/withdrawals only incidentally.
  if (type.includes('fund') || type.includes('exchange') || type.includes('assign')) return null;
  if (type.includes('withdraw')) return 'withdrawal';
  if (type.includes('deposit')) return 'deposit';
  return null; // "Others", "Currency Exchange", "Coupon", dividends, etc.
}

export async function syncCashFlowsToTransactions(
  userId: string,
  accountId: string,
  cashflows: CashFlowItem[],
): Promise<{ inserted: number; skipped: number }> {
  if (cashflows.length === 0) return { inserted: 0, skipped: 0 };

  // Keep only genuine capital deposits/withdrawals.
  const contributions = cashflows
    .map((item) => ({ item, kind: classifyContribution(item) }))
    .filter((row): row is { item: CashFlowItem; kind: ContributionType } => row.kind !== null);
  if (contributions.length === 0) return { inserted: 0, skipped: 0 };

  // Dedupe against already-stored rows. Cash-flow IDs are namespaced ("cf-…")
  // so they never collide with deal IDs in the shared brokerDealId column.
  const existing = await prisma.transaction.findMany({
    where: { userId, brokerDealId: { not: null } },
    select: { brokerDealId: true },
  });
  const existingIds = new Set(existing.map((r) => r.brokerDealId!));

  const fresh = contributions.filter(
    ({ item }) =>
      !existingIds.has(`cf-${item.cashflow_id}`) &&
      !isNaN(new Date(item.clearing_date).getTime()),
  );
  const skipped = contributions.length - fresh.length;
  if (fresh.length === 0) return { inserted: 0, skipped };

  const rows = fresh.map(({ item, kind }) => ({
    userId,
    accountId,
    assetId: null, // a cash deposit/withdrawal is not tied to a security
    brokerDealId: `cf-${item.cashflow_id}`,
    type: kind, // 'deposit' | 'withdrawal' — matches externalFlows()
    tradeDate: new Date(item.clearing_date),
    quantity: 0,
    price: Math.abs(item.amount), // externalFlows uses price (± fee) as the flow size
    fee: 0,
    currency: item.currency || 'USD',
    notes: `Synced from moomoo cash flow ${item.cashflow_id} (${item.cashflow_type})`,
  }));

  const result = await prisma.transaction.createMany({ data: rows });
  return { inserted: result.count, skipped };
}
