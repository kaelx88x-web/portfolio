import { describe, it, expect } from 'vitest';
import { summariseCashflow, filterCashflow, formatCashflowAmount } from './summary';
import type { CashFlowItem } from '$lib/services/broker.service';

/**
 * Layer 1 (TS) — cash-flow data validation for /cashflow.
 *
 * Grounding: moomoo get_acc_cash_flow provides the authoritative IN/OUT
 * `cashflow_direction` and a SIGNED `cashflow_amount`. The page trusts direction
 * and renders magnitude via Math.abs(). These tests assert that behaviour and
 * DOCUMENT two real limitations (see BUG markers): currency-mixing in totals and
 * NaN on malformed amounts. They intentionally encode current behaviour.
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

// A realistic mixed set (directions as moomoo would label them).
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
    const s = summariseCashflow(SET);
    // IN: dividend 12.5 + premium credit 113 + deposit 500 = 625.5
    expect(s.totalIn).toBeCloseTo(625.5, 2);
    // OUT: premium debit 40 + withdrawal 200 + fee 3 = 243 (magnitudes)
    expect(s.totalOut).toBeCloseTo(243, 2);
    // premium debit & fee must NOT be in totalIn
    expect(s.totalIn).not.toBeCloseTo(625.5 + 40 + 3, 2);
  });
});

describe('Layer 1 — aggregates & count', () => {
  it('net = in − out, count = number of rows', () => {
    const s = summariseCashflow(SET);
    expect(s.net).toBeCloseTo(625.5 - 243, 2);
    expect(s.count).toBe(6);
  });
});

describe('Layer 1 — sign handling (signed amount → magnitude by direction)', () => {
  it('uses |amount| and direction for sign; negative OUT amounts become positive magnitudes', () => {
    const s = summariseCashflow([cf({ cashflow_direction: 'OUT', amount: -40 })]);
    expect(s.totalOut).toBe(40);
    expect(formatCashflowAmount(cf({ cashflow_direction: 'OUT', amount: -40, currency: 'USD' }))).toBe('-40.00 USD');
    expect(formatCashflowAmount(cf({ cashflow_direction: 'IN', amount: 113, currency: 'USD' }))).toBe('+113.00 USD');
  });
});

describe('Layer 1 — filter recomputes totals (page behaviour)', () => {
  it('direction filter recomputes totals over the filtered set', () => {
    const inOnly = summariseCashflow(SET, 'All', 'IN');
    expect(inOnly.count).toBe(3);
    expect(inOnly.totalIn).toBeCloseTo(625.5, 2);
    expect(inOnly.totalOut).toBe(0);
    const outOnly = summariseCashflow(SET, 'All', 'OUT');
    expect(outOnly.totalOut).toBeCloseTo(243, 2);
    expect(outOnly.totalIn).toBe(0);
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
    expect(s.totalIn).toBe(0);
  });
  it('empty set → zeros', () => {
    const s = summariseCashflow([]);
    expect(s).toMatchObject({ totalIn: 0, totalOut: 0, net: 0, count: 0 });
  });
});

// ───────────────────────── BUGS DOCUMENTED (current behaviour) ─────────────

describe('Layer 1 — BUG: totals mix currencies with no FX conversion', () => {
  it('sums USD + MYR into one unitless number (no conversion) — currencies flags the mix', () => {
    const mixed = summariseCashflow([
      cf({ cashflow_direction: 'IN', amount: 100, currency: 'USD' }),
      cf({ cashflow_direction: 'IN', amount: 100, currency: 'MYR' }),
    ]);
    // Current (buggy) behaviour: 100 USD + 100 MYR = 200, no FX, no currency unit.
    expect(mixed.totalIn).toBe(200);
    // The mix is detectable — a correct impl would convert to one base currency.
    expect(mixed.currencies.length).toBeGreaterThan(1);
    expect(mixed.currencies).toEqual(expect.arrayContaining(['USD', 'MYR']));
  });
});

describe('Layer 1 — BUG: malformed amount yields NaN (no guard)', () => {
  it('missing amount propagates NaN into totals (should be coerced/skipped)', () => {
    const s = summariseCashflow([cf({ cashflow_direction: 'IN', amount: undefined as unknown as number })]);
    expect(Number.isNaN(s.totalIn)).toBe(true); // documents the gap
  });
});
