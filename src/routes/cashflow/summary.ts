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

export type CashflowSummary = {
  filtered: CashFlowItem[];
  totalIn: number;
  totalOut: number;
  net: number;
  count: number;
  /** Distinct currencies present in the filtered set — >1 means totals mix currencies. */
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

/**
 * Totals recompute over the FILTERED set (not the full list) — matching the
 * page. totalIn/totalOut sum magnitudes by direction; net = in − out. No FX:
 * amounts are summed regardless of currency (see `currencies`).
 */
export function summariseCashflow(
  items: CashFlowItem[],
  filterType = 'All',
  filterDir = 'All',
): CashflowSummary {
  const filtered = filterCashflow(items, filterType, filterDir);
  const totalIn = filtered
    .filter((i) => i.cashflow_direction === 'IN')
    .reduce((s, i) => s + Math.abs(i.amount), 0);
  const totalOut = filtered
    .filter((i) => i.cashflow_direction === 'OUT')
    .reduce((s, i) => s + Math.abs(i.amount), 0);
  const currencies = [...new Set(filtered.map((i) => i.currency).filter(Boolean))];
  return { filtered, totalIn, totalOut, net: totalIn - totalOut, count: filtered.length, currencies };
}

/** Per-row display string, e.g. "+1,234.56 USD" — sign from direction, magnitude abs. */
export function formatCashflowAmount(item: CashFlowItem): string {
  const sign = item.cashflow_direction === 'IN' ? '+' : '-';
  return `${sign}${Math.abs(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${item.currency}`;
}
