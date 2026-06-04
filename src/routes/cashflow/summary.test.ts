import { describe, it, expect } from 'vitest';
import { summariseCashflow, filterCashflow, formatCashflowAmount, type CurrencyTotals } from './summary';
import type { CashFlowItem } from '$lib/services/broker.service';

/**
 * Layer 1 (TS) — cash-flow data validation for /cashflow.
 *
 * Grounding: moomoo get_acc_cash_flow provides the authoritative IN/OUT
 * `cashflow_direction` and a SIGNED `cashflow_amount`. The page trusts direction
 * and renders magnitude via Math.abs(). Totals are grouped PER CURRENCY — there
 * is no FX conversion and no cross-currency summing; each currency is reported
 * in its own unit, exactly as the broker API returns it.
 */
function cf(p: Partial<CashFlowItem>): CashFlowItem {
  return {
    cashflow_id: '1',
    clearing_date: '2026-05-29',
    settlement_date: '2026-05-29',
    currency: 'USD',
    cashflow_type: 'Others',
    cashflow_direction: 'IN',
    amount: 10,
    remark: '',
    ...p,
  };
}

const ccy = (s: { byCurrency: CurrencyTotals[] }, c: string) =>
  s.byCurrency.find((x) => x.currency === c);

// A realistic mixed set (directions as moomoo would label them), all USD.
const SET: CashFlowItem[] = [
  cf({ cashflow_id: 'd1', cashflow_type: 'Fund Dividend', cashflow_direction: 'IN', amount: 12.5 }),
  cf({ cashflow_id: 'p1', cashflow_type: 'Option Premium', cashflow_direction: 'IN', amount: 113 }), // sell-to-open credit
  cf({ cashflow_id: 'p2', cashflow_type: 'Option Premium', cashflow_direction: 'OUT', amount: -40 }), // buy-to-close debit
  cf({ cashflow_id: 'dep', cashflow_type: 'Bank Transfer Deposits', cashflow_direction: 'IN', amount: 500 }),
  cf({ cashflow_id: 'wd', cashflow_type: 'Bank Transfer Withdrawals', cashflow_direction: 'OUT', amount: -200 }),
  cf({ cashflow_id: 'fee', cashflow_type: 'Fee', cashflow_direction: 'OUT', amount: -3 }),
];

describe('Layer 1 — categorisation respects moomoo cashflow_direction', () => {
  it('every IN type lands in totalIn, every OUT type in totalOut (incl. premium debit & fee)', () => {
    const usd = ccy(summariseCashflow(SET), 'USD')!;
    // IN: dividend 12.5 + premium credit 113 + deposit 500 = 625.5
    expect(usd.totalIn).toBeCloseTo(625.5, 2);
    // OUT: premium debit 40 + withdrawal 200 + fee 3 = 243 (magnitudes)
    expect(usd.totalOut).toBeCloseTo(243, 2);
    // premium debit & fee must NOT be in totalIn
    expect(usd.totalIn).not.toBeCloseTo(625.5 + 40 + 3, 2);
  });
});

describe('Layer 1 — aggregates & count', () => {
  it('net = in − out (per currency), count = number of rows', () => {
    const s = summariseCashflow(SET);
    expect(ccy(s, 'USD')!.net).toBeCloseTo(625.5 - 243, 2);
    expect(ccy(s, 'USD')!.count).toBe(6);
    expect(s.count).toBe(6);
  });
});

describe('Layer 1 — sign handling (signed amount → magnitude by direction)', () => {
  it('uses |amount| and direction for sign; negative OUT amounts become positive magnitudes', () => {
    const usd = ccy(summariseCashflow([cf({ cashflow_direction: 'OUT', amount: -40 })]), 'USD')!;
    expect(usd.totalOut).toBe(40);
    expect(formatCashflowAmount(cf({ cashflow_direction: 'OUT', amount: -40, currency: 'USD' }))).toBe('-40.00 USD');
    expect(formatCashflowAmount(cf({ cashflow_direction: 'IN', amount: 113, currency: 'USD' }))).toBe('+113.00 USD');
  });
});

describe('Layer 1 — filter recomputes totals (page behaviour)', () => {
  it('direction filter recomputes totals over the filtered set', () => {
    const inOnly = summariseCashflow(SET, 'All', 'IN');
    expect(inOnly.count).toBe(3);
    expect(ccy(inOnly, 'USD')!.totalIn).toBeCloseTo(625.5, 2);
    expect(ccy(inOnly, 'USD')!.totalOut).toBe(0);
    const outOnly = summariseCashflow(SET, 'All', 'OUT');
    expect(ccy(outOnly, 'USD')!.totalOut).toBeCloseTo(243, 2);
    expect(ccy(outOnly, 'USD')!.totalIn).toBe(0);
  });
  it('type filter narrows to that type', () => {
    expect(filterCashflow(SET, 'Fee').length).toBe(1);
    expect(summariseCashflow(SET, 'Option Premium').count).toBe(2);
  });
});

describe('Layer 1 — 0 amount and empty set', () => {
  it('a $0 transaction counts in row count but adds nothing', () => {
    const s = summariseCashflow([cf({ amount: 0, cashflow_direction: 'IN' })]);
    expect(s.count).toBe(1);
    expect(ccy(s, 'USD')!.totalIn).toBe(0);
  });
  it('empty set → no currencies, zero count', () => {
    const s = summariseCashflow([]);
    expect(s.byCurrency).toEqual([]);
    expect(s.count).toBe(0);
    expect(s.currencies).toEqual([]);
  });
});

// ───────────────────────── Multi-currency: display from API, no FX ─────────

describe('Layer 1 — multi-currency totals are split per currency (no FX)', () => {
  it('USD and MYR are reported separately, each in its own unit (never summed)', () => {
    const s = summariseCashflow([
      cf({ cashflow_direction: 'IN', amount: 100, currency: 'USD' }),
      cf({ cashflow_direction: 'IN', amount: 100, currency: 'MYR' }),
    ]);
    expect(s.currencies).toEqual(['MYR', 'USD']); // sorted by code
    expect(ccy(s, 'USD')!.totalIn).toBe(100);
    expect(ccy(s, 'MYR')!.totalIn).toBe(100);
    // No cross-currency sum exists — there is no single combined "200".
    expect(s.byCurrency).toHaveLength(2);
  });
});

describe('Layer 1 — malformed amount is treated as 0 (display from API, no NaN)', () => {
  it('missing amount does not propagate NaN into totals', () => {
    const usd = ccy(
      summariseCashflow([cf({ cashflow_direction: 'IN', amount: undefined as unknown as number })]),
      'USD',
    )!;
    expect(usd.totalIn).toBe(0);
    expect(Number.isNaN(usd.totalIn)).toBe(false);
  });
});
