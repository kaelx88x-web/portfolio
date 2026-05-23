// src/lib/services/option-scanner.service.ts
import { randomUUID } from 'node:crypto';
import type { OptionAlert, OptionPosition, OptionType } from '$lib/server/queues';
import type { BrokerHolding } from '$lib/types/portfolio';

// ─── Alert Detection ─────────────────────────────────────────────────────────

export function detectAlerts(positions: OptionPosition[], userId: string): OptionAlert[] {
  const alerts: OptionAlert[] = [];
  const now = new Date().toISOString();

  for (const pos of positions) {
    // ── Expiry: urgent (≤ 3 days) ────────────────────────────────────────
    if (pos.dte <= 3) {
      alerts.push({
        id: randomUUID(),
        userId,
        symbol: pos.symbol,
        optionType: pos.optionType,
        severity: 'urgent',
        message: `${pos.symbol} expiring in ${pos.dte} day${pos.dte === 1 ? '' : 's'}`,
        recommendation: buildExpiryRecommendation(pos),
        position: pos,
        detectedAt: now,
        acknowledged: false,
      });
    }
    // ── Expiry: info (4–7 days) ───────────────────────────────────────────
    else if (pos.dte <= 7) {
      alerts.push({
        id: randomUUID(),
        userId,
        symbol: pos.symbol,
        optionType: pos.optionType,
        severity: 'info',
        message: `${pos.symbol} expiring in ${pos.dte} days — review soon`,
        recommendation: 'Monitor this position. Plan your action: roll, close, or let expire.',
        position: pos,
        detectedAt: now,
        acknowledged: false,
      });
    }

    // ── Assignment risk: covered call in-the-money ────────────────────────
    if (pos.optionType === 'covered_call' && pos.currentPrice > pos.strike && pos.dte <= 7) {
      alerts.push({
        id: randomUUID(),
        userId,
        symbol: pos.symbol,
        optionType: pos.optionType,
        severity: 'urgent',
        message: `${pos.symbol} covered call is in-the-money — assignment likely`,
        recommendation:
          'Stock may be called away at expiry. If you want to keep your shares, roll up or out. ' +
          'If you are happy selling at the strike price, let it be assigned.',
        position: pos,
        detectedAt: now,
        acknowledged: false,
      });
    }

    // ── Strike below cost basis (covered call) ────────────────────────────
    if (
      pos.optionType === 'covered_call' &&
      pos.costBasis !== undefined &&
      pos.strike < pos.costBasis
    ) {
      alerts.push({
        id: randomUUID(),
        userId,
        symbol: pos.symbol,
        optionType: pos.optionType,
        severity: 'urgent',
        message: `${pos.symbol} CC strike $${pos.strike} is below your cost basis $${pos.costBasis?.toFixed(2)}`,
        recommendation:
          'If assigned at this strike you will lock in a loss on your shares. ' +
          'Consider rolling up to a strike above your cost basis, or closing the covered call.',
        position: pos,
        detectedAt: now,
        acknowledged: false,
      });
    }

    // ── Profit targets ────────────────────────────────────────────────────
    if (pos.profitPct >= 80) {
      alerts.push({
        id: randomUUID(),
        userId,
        symbol: pos.symbol,
        optionType: pos.optionType,
        severity: 'profitable',
        message: `${pos.symbol} has captured ${pos.profitPct.toFixed(0)}% of max premium`,
        recommendation:
          'You have locked in most of the available profit. Closing now frees up capital ' +
          'and removes the remaining risk for a small additional gain. Strongly consider closing early.',
        position: pos,
        detectedAt: now,
        acknowledged: false,
      });
    } else if (pos.profitPct >= 70) {
      alerts.push({
        id: randomUUID(),
        userId,
        symbol: pos.symbol,
        optionType: pos.optionType,
        severity: 'profitable',
        message: `${pos.symbol} at ${pos.profitPct.toFixed(0)}% of max profit`,
        recommendation:
          'Good profit captured. You can close now for a solid gain, or hold for the remaining 30%. ' +
          'Closing reduces risk from unexpected price moves.',
        position: pos,
        detectedAt: now,
        acknowledged: false,
      });
    } else if (pos.profitPct >= 50) {
      alerts.push({
        id: randomUUID(),
        userId,
        symbol: pos.symbol,
        optionType: pos.optionType,
        severity: 'info',
        message: `${pos.symbol} at 50% of max profit — early close opportunity`,
        recommendation:
          'Many traders close at 50% profit to reduce risk and redeploy capital. ' +
          'Assess whether the remaining premium is worth the time and risk.',
        position: pos,
        detectedAt: now,
        acknowledged: false,
      });
    }
  }

  return alerts;
}

function buildExpiryRecommendation(pos: OptionPosition): string {
  if (pos.optionType === 'covered_call') {
    if (pos.currentPrice > pos.strike) {
      return (
        'Your covered call is in-the-money and expiring soon. ' +
        'If you want to keep your shares: roll out to a later date and higher strike. ' +
        'If you are OK with selling: let it expire and collect your premium.'
      );
    }
    return (
      'Your covered call is expiring out-of-the-money — you keep the premium. ' +
      'You can let it expire worthless and sell a new covered call next week.'
    );
  }
  if (pos.optionType === 'cash_secured_put') {
    if (pos.currentPrice < pos.strike) {
      return (
        'Your put is in-the-money and expiring soon — assignment likely. ' +
        'You will need to buy 100 shares at the strike price. ' +
        'If you want the shares: let it happen. If not: buy back the put now to avoid assignment.'
      );
    }
    return (
      'Your cash secured put is expiring out-of-the-money — you keep the premium. ' +
      'No action needed unless you want to roll to a new put.'
    );
  }
  return 'Position expiring soon. Review and decide: close, roll, or let expire.';
}

// ─── Parse moomoo holdings into OptionPosition ───────────────────────────────

export function parseOptionPositions(holdings: BrokerHolding[]): OptionPosition[] {
  return holdings
    .filter((h) => isOptionHolding(h))
    .map((h) => parseOptionPosition(h))
    .filter((p): p is OptionPosition => p !== null);
}

function isOptionHolding(h: BrokerHolding): boolean {
  const type = h.asset_type?.toLowerCase() ?? '';
  return (
    type.includes('option') ||
    type.includes('call') ||
    type.includes('put') ||
    isOptionSymbol(h.symbol)
  );
}

function isOptionSymbol(symbol: string): boolean {
  // Standard US option format: TICKER + YYMMDD + C/P + STRIKE_x1000
  return /^[A-Z]+\d{6}[CP]\d+$/.test(symbol);
}

function parseOptionPosition(h: BrokerHolding): OptionPosition | null {
  const match = h.symbol.match(/^([A-Z]+)(\d{6})([CP])(\d+)$/);
  if (!match) return null;

  const [, , dateStr, callPut, strikeStr] = match;
  const expiry = parseOptionDate(dateStr);
  const strike = parseInt(strikeStr, 10) / 1000;
  const dte = Math.max(0, Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000));

  const isShort = h.quantity < 0;
  const optionType: OptionType =
    callPut === 'C'
      ? isShort ? 'covered_call' : 'long_call'
      : isShort ? 'cash_secured_put' : 'long_put';

  const premiumCollected = isShort ? Math.abs(h.average_cost) : 0;
  const currentValue = Math.abs(h.market_price);
  const rawProfit =
    premiumCollected > 0
      ? ((premiumCollected - currentValue) / premiumCollected) * 100
      : 0;
  const profitPct = Math.min(100, Math.max(0, rawProfit));

  return {
    symbol: h.symbol,
    name: h.name,
    optionType,
    strike,
    expiry,
    dte,
    quantity: Math.abs(h.quantity),
    premiumCollected,
    currentValue,
    unrealizedPnl: h.unrealized_pl,
    profitPct,
    currentPrice: 0, // underlying price not available from option holding alone
  };
}

function parseOptionDate(dateStr: string): string {
  const year = 2000 + parseInt(dateStr.slice(0, 2), 10);
  const month = dateStr.slice(2, 4);
  const day = dateStr.slice(4, 6);
  return `${year}-${month}-${day}`;
}

// ─── Convert DB OptionsPosition to OptionPosition ────────────────────────────

export function fromDbOptionsPosition(row: {
  symbol: string;
  optionType: string;
  strike: number;
  expirationDate: Date;
  contracts: number;
  premium: number;
  collateral: number;
  status: string;
  metadataJson: string;
}): OptionPosition {
  const expiry = row.expirationDate.toISOString().slice(0, 10);
  const dte = Math.max(0, Math.ceil((row.expirationDate.getTime() - Date.now()) / 86_400_000));

  let meta: Record<string, unknown> = {};
  try { meta = JSON.parse(row.metadataJson ?? '{}'); } catch { /* ignore */ }

  const currentValue = typeof meta.currentValue === 'number' ? meta.currentValue : 0;
  const rawProfit =
    row.premium > 0
      ? ((row.premium - currentValue) / row.premium) * 100
      : 0;

  return {
    symbol: row.symbol,
    name: typeof meta.name === 'string' ? meta.name : row.symbol,
    optionType: row.optionType as OptionType,
    strike: row.strike,
    expiry,
    dte,
    quantity: row.contracts,
    premiumCollected: row.premium,
    currentValue,
    unrealizedPnl: typeof meta.unrealizedPnl === 'number' ? meta.unrealizedPnl : 0,
    profitPct: Math.min(100, Math.max(0, rawProfit)),
    currentPrice: typeof meta.currentPrice === 'number' ? meta.currentPrice : 0,
    costBasis: typeof meta.costBasis === 'number' ? meta.costBasis : undefined,
  };
}
