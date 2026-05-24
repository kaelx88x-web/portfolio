// src/lib/services/execution-bridge.service.ts
import { createTradeTicket, cancelTradeTicket } from '$lib/services/trade-layer.service';
import { fetchYahooPrices } from '$lib/services/market-price.service';
import { getHoldings } from '$lib/services/portfolio.service';
import type { RebalanceSuggestion } from '$lib/services/optimization-engine.service';
import type { CoveredCallCandidate, PutExposureRow } from '$lib/services/options-intelligence.service';
import type { TradeTicket } from '$lib/services/trade-layer.service';

export type DTE = 21 | 30 | 45 | 60;
export const DTE_OPTIONS: DTE[] = [21, 30, 45, 60];

export type RebalanceQueueResult = {
  tickets: TradeTicket[];
  skipped: Array<{ label: string; reason: string }>;
};

export function parseDte(value: FormDataEntryValue | string | null): DTE {
  const n = Number(value ?? 30);
  return (DTE_OPTIONS as number[]).includes(n) ? (n as DTE) : 30;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Returns 'YYMMDD' string for the nearest monthly expiry (third Friday) >= today+dte */
export function nearestMonthlyExpiry(dte: DTE): string {
  const today = new Date();
  const target = new Date(today);
  target.setDate(target.getDate() + dte);

  const friday = thirdFridayOfMonth(target.getFullYear(), target.getMonth());
  if (friday >= target) return toYYMMDD(friday);

  // Use next month
  const nm = new Date(target.getFullYear(), target.getMonth() + 1, 1);
  const nextFriday = thirdFridayOfMonth(nm.getFullYear(), nm.getMonth());
  return toYYMMDD(nextFriday ?? target);
}

function thirdFridayOfMonth(year: number, month: number): Date {
  // Find first Friday of month, then add 14 days for the third
  const first = new Date(year, month, 1);
  const dayOfWeek = first.getDay(); // 0=Sun … 6=Sat, 5=Fri
  const firstFriday = 1 + ((5 - dayOfWeek + 7) % 7);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const thirdFridayDay = firstFriday + 14;
  return new Date(year, month, thirdFridayDay > daysInMonth ? thirdFridayDay - 7 : thirdFridayDay);
}

function toYYMMDD(date: Date): string {
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/** Build contract symbol. Matches observed format: PATH260529P9500 (no zero-padding). */
function toContractSymbol(underlying: string, expiry: string, type: 'C' | 'P', strike: number): string {
  return `${underlying}${expiry}${type}${Math.round(strike * 1000)}`;
}

/** Extract underlying ticker from contract symbol e.g. PATH260529P9500 → PATH */
export function extractUnderlying(contractSymbol: string): string {
  return contractSymbol.replace(/^US\./, '').match(/^([A-Z]+)\d{6}/)?.[1] ?? contractSymbol;
}

// ── Rebalance ─────────────────────────────────────────────────────────────────

export async function rebalanceSuggestionsToTickets(
  userId: string,
  suggestions: RebalanceSuggestion[],
  totalPortfolioValue: number
): Promise<RebalanceQueueResult> {
  const tickets: TradeTicket[] = [];
  const skipped: Array<{ label: string; reason: string }> = [];

  // Flatten allocations with meaningful delta (>= 0.5%) and skip cash
  const tradeable = suggestions.flatMap((s) =>
    s.targetAllocation
      .filter((a) => Math.abs(a.deltaPct) >= 0.5 && a.role !== 'cash')
      .map((a) => ({ allocation: a }))
  );

  if (tradeable.length === 0) return { tickets: [], skipped: [] };

  const symbols = [...new Set(tradeable.map((t) => t.allocation.label))];
  const prices = await fetchYahooPrices(symbols);

  for (const { allocation } of tradeable) {
    const symbol = allocation.label;
    const price = prices[symbol];

    if (!price || price <= 0) {
      skipped.push({ label: symbol, reason: 'price unavailable' });
      continue;
    }

    const side = allocation.deltaPct > 0 ? ('buy' as const) : ('sell' as const);
    const dollarAmount = (Math.abs(allocation.deltaPct) / 100) * totalPortfolioValue;
    const quantity = Math.max(1, Math.round(dollarAmount / price));

    const ticket = await createTradeTicket(userId, {
      sourceType: 'rebalance_bridge',
      sourceId: null,
      ticketType: side === 'buy' ? 'buy' : 'sell',
      symbol,
      side,
      quantity,
      orderType: 'market',
      limitPrice: null,
      thesis: `Rebalance: ${allocation.deltaPct > 0 ? '+' : ''}${allocation.deltaPct.toFixed(1)}% target adjustment`,
      metadata: { source: 'execution-bridge', mode: 'paper', deltaPct: allocation.deltaPct }
    });

    tickets.push(ticket);
  }

  return { tickets, skipped };
}

// ── Options ───────────────────────────────────────────────────────────────────

export async function coveredCallToTicket(
  userId: string,
  candidate: CoveredCallCandidate,
  dte: DTE
): Promise<TradeTicket> {
  const expiry = nearestMonthlyExpiry(dte);
  const contractSymbol = toContractSymbol(candidate.symbol, expiry, 'C', candidate.suggested_strike);
  // limitPrice = per-share premium (estimated_premium already in dollars for all contracts)
  const premiumPerShare = candidate.possible_contracts > 0
    ? candidate.estimated_premium / (candidate.possible_contracts * 100)
    : 0;

  return createTradeTicket(userId, {
    sourceType: 'options_bridge',
    sourceId: null,
    ticketType: 'covered_call',
    symbol: contractSymbol,
    side: 'open',
    quantity: candidate.possible_contracts,
    orderType: 'limit',
    limitPrice: premiumPerShare > 0 ? premiumPerShare : null,
    thesis: `Covered call: ${candidate.symbol} strike $${candidate.suggested_strike} expiry ${expiry} (~${dte} DTE)`,
    metadata: {
      source: 'execution-bridge',
      mode: 'paper',
      underlying: candidate.symbol,
      strike: candidate.suggested_strike,
      expiry,
      dte
    }
  });
}

export async function cspToTicket(
  userId: string,
  row: PutExposureRow,
  dte: DTE
): Promise<TradeTicket> {
  const underlying = extractUnderlying(row.symbol);
  const expiry = nearestMonthlyExpiry(dte);
  const contractSymbol = toContractSymbol(underlying, expiry, 'P', row.strike);
  const premiumPerShare = row.contracts > 0 ? row.premium / (row.contracts * 100) : 0;

  return createTradeTicket(userId, {
    sourceType: 'options_bridge',
    sourceId: null,
    ticketType: 'cash_secured_put',
    symbol: contractSymbol,
    side: 'open',
    quantity: row.contracts,
    orderType: 'limit',
    limitPrice: premiumPerShare > 0 ? premiumPerShare : null,
    thesis: `Cash-secured put: ${underlying} strike $${row.strike} expiry ${expiry} (~${dte} DTE)`,
    metadata: {
      source: 'execution-bridge',
      mode: 'paper',
      underlying,
      strike: row.strike,
      expiry,
      dte
    }
  });
}

export async function cancelBridgeTicket(userId: string, ticketId: string): Promise<void> {
  await cancelTradeTicket(userId, ticketId, 'Replaced — DTE or params changed');
}

// getHoldings is imported for use by callers that need holdings context alongside bridge ops.
export { getHoldings };
