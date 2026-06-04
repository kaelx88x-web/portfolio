/**
 * Pure cash-flow summary logic, extracted verbatim from +page.svelte so it can
 * be unit-tested. Behaviour is intentionally identical to the rendered page —
 * including its current limitations — so tests document real behaviour.
 *
 * Grounding (moomoo get_acc_cash_flow / Trd_GetCashFlow, Protocol 2226):
 *  - cashflow_direction is the authoritative IN/OUT enum (we trust it, we do not
 *    re-derive categories from cashflow_type).
 *  - cashflow_amount is a SIGNED float (positive=inflow, negative=outflow); the
 *    page displays magnitude via Math.abs() and takes the sign from direction.
 *  - currency is per-transaction; there is NO FX conversion here.
 */
import type { CashFlowItem } from '$lib/services/broker.service';

/** Totals for a single currency — reported in that currency's own unit (no FX). */
export type CurrencyTotals = {
  currency: string;
  totalIn: number;
  totalOut: number;
  net: number;
  count: number;
};

export type CashflowSummary = {
  filtered: CashFlowItem[];
  /**
   * Per-currency totals, one entry per currency present, each in its own unit.
   * We do NOT convert (no FX) and we do NOT sum across currencies — amounts are
   * displayed exactly as the broker API reports them. Sorted by currency code.
   */
  byCurrency: CurrencyTotals[];
  count: number;
  /** Distinct currencies present in the filtered set. */
  currencies: string[];
};

export function filterCashflow(
  items: CashFlowItem[],
  filterType = 'All',
  filterDir = 'All',
): CashFlowItem[] {
  return items.filter(
    (i) =>
      (filterType === 'All' || i.cashflow_type === filterType) &&
      (filterDir === 'All' || i.cashflow_direction === filterDir),
  );
}

/** Magnitude of an amount, guarding against missing/malformed values from the API. */
function magnitude(amount: number): number {
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

/**
 * Totals recompute over the FILTERED set (not the full list) — matching the
 * page. Inflows/outflows are grouped BY CURRENCY (no FX, no cross-currency
 * summing): each currency's totals are reported in its own unit. totalIn/
 * totalOut sum magnitudes by direction; net = in − out.
 */
export function summariseCashflow(
  items: CashFlowItem[],
  filterType = 'All',
  filterDir = 'All',
): CashflowSummary {
  const filtered = filterCashflow(items, filterType, filterDir);

  const byCcy = new Map<string, CurrencyTotals>();
  for (const i of filtered) {
    const currency = i.currency || 'USD';
    const t =
      byCcy.get(currency) ?? { currency, totalIn: 0, totalOut: 0, net: 0, count: 0 };
    const mag = magnitude(i.amount);
    if (i.cashflow_direction === 'IN') t.totalIn += mag;
    else if (i.cashflow_direction === 'OUT') t.totalOut += mag;
    t.count += 1;
    byCcy.set(currency, t);
  }
  const byCurrency = [...byCcy.values()]
    .map((t) => ({ ...t, net: t.totalIn - t.totalOut }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  return {
    filtered,
    byCurrency,
    count: filtered.length,
    currencies: byCurrency.map((t) => t.currency),
  };
}

/** Per-row display string, e.g. "+1,234.56 USD" — sign from direction, magnitude abs. */
export function formatCashflowAmount(item: CashFlowItem): string {
  const sign = item.cashflow_direction === 'IN' ? '+' : '-';
  return `${sign}${magnitude(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${item.currency}`;
}
