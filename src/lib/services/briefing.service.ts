// src/lib/services/briefing.service.ts

import type { AllocationSlice, SnapshotHolding } from '$lib/types/portfolio';
import type {
  BriefingAlert,
  DailyBriefing,
  ParsedBriefingOption,
  PortfolioMover,
} from '$lib/types/briefing';

// ─── Symbol Helpers ───────────────────────────────────────────────────────────

const OCC_REGEX = /^([A-Z]+)(\d{6})([CP])(\d+)$/;

function stripMarketSuffix(symbol: string): string {
  return (symbol.split('.')[0] ?? symbol).toUpperCase();
}

function isOptionSymbol(symbol: string): boolean {
  return OCC_REGEX.test(stripMarketSuffix(symbol));
}

// ─── Module-level Constants ───────────────────────────────────────────────────

const PLACEHOLDER_VIX = 18.2; // Phase 1: static placeholder — replace with live API in Phase 2

// ─── Health Score ─────────────────────────────────────────────────────────────

export function computeHealthScore(params: {
  top5Pct: number;
  topSectorPct: number;
  totalReturnPct: number;
}): { score: number; label: 'Good' | 'Moderate' | 'Weak' } {
  let score = 100;

  // Concentration penalty
  if (params.top5Pct >= 80) score -= 25;
  else if (params.top5Pct >= 65) score -= 15;
  else if (params.top5Pct >= 50) score -= 8;

  // Sector concentration penalty
  if (params.topSectorPct >= 50) score -= 20;
  else if (params.topSectorPct >= 40) score -= 10;
  else if (params.topSectorPct >= 35) score -= 5;

  // Drawdown penalty
  if (params.totalReturnPct <= -20) score -= 20;
  else if (params.totalReturnPct <= -10) score -= 10;
  else if (params.totalReturnPct <= -5) score -= 5;

  score = Math.max(0, Math.min(100, score));

  const label: 'Good' | 'Moderate' | 'Weak' =
    score >= 70 ? 'Good' : score >= 45 ? 'Moderate' : 'Weak';

  return { score, label };
}

// ─── Market Regime ────────────────────────────────────────────────────────────

export function computeMarketRegime(
  vix: number,
): 'Risk-On' | 'Neutral' | 'Risk-Off' | 'Bearish' {
  if (vix < 15) return 'Risk-On';
  if (vix < 20) return 'Neutral';
  if (vix <= 25) return 'Risk-Off';
  return 'Bearish';
}

// ─── Option Symbol Parsing ────────────────────────────────────────────────────

function normalizeStrike(raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  if (value >= 1000) return value / 1000;
  return value;
}

export function parseOptionsFromSnapshot(
  snapshotRows: SnapshotHolding[],
): ParsedBriefingOption[] {
  return snapshotRows
    .map((h) => {
      // Strip market suffix (e.g. "NIO260530C00005500.US" → "NIO260530C00005500")
      const local = stripMarketSuffix(h.symbol);
      const match = local.match(OCC_REGEX);
      if (!match) return null;
      const [, underlying, rawDate, cp, rawStrike] = match;
      const year = 2000 + Number(rawDate.slice(0, 2));
      const month = Number(rawDate.slice(2, 4));
      const day = Number(rawDate.slice(4, 6));
      const expiration = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const expiryUtc = Date.UTC(year, month - 1, day);
      const todayUtc = Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate(),
      );
      const dte = Math.max(0, Math.ceil((expiryUtc - todayUtc) / 86_400_000));
      return {
        symbol: h.symbol,
        underlying,
        optionType: cp === 'C' ? ('call' as const) : ('put' as const),
        strike: normalizeStrike(rawStrike),
        expiration,
        dte,
        premium: Math.abs(h.marketValue),
        marketValue: h.marketValue,
        unrealizedPnl: h.unrealizedPnl,
        quantity: h.quantity,
      };
    })
    .filter((p): p is ParsedBriefingOption => p !== null);
}

// ─── Options Data (theta + alerts) ───────────────────────────────────────────

export function computeOptionsData(options: ParsedBriefingOption[]): {
  thetaToday: number;
  optionsCount: number;
  alerts: BriefingAlert[];
} {
  const alerts: BriefingAlert[] = [];
  let thetaToday = 0;

  for (const opt of options) {
    // Rough daily theta estimate: premium / DTE (for short options, premium decays)
    if (opt.dte > 0) {
      thetaToday += Math.abs(opt.premium) / opt.dte;
    }

    // Alert: expiring in ≤5 days
    if (opt.dte <= 5 && alerts.filter((a) => a.type === 'warning').length < 2) {
      const typeLabel = opt.optionType === 'call' ? 'CC' : 'CSP';
      alerts.push({
        type: 'warning',
        text: `${opt.underlying} $${opt.strike} ${typeLabel} — expires in ${opt.dte} day${opt.dte !== 1 ? 's' : ''}`,
      });
    }

    // Alert: position at ≥75% profit
    // costBasis = marketValue − unrealizedPnl; profitPct = unrealizedPnl / |costBasis|
    const costBasis = opt.marketValue - opt.unrealizedPnl;
    if (costBasis !== 0 && opt.unrealizedPnl > 0) {
      const profitPct = Math.abs(opt.unrealizedPnl / costBasis);
      if (profitPct >= 0.75 && alerts.filter((a) => a.type === 'success').length < 1) {
        alerts.push({
          type: 'success',
          text: `${opt.underlying} ${opt.optionType} at ${(profitPct * 100).toFixed(0)}% profit — consider closing`,
        });
      }
    }
  }

  return { thetaToday, optionsCount: options.length, alerts };
}

// ─── Sector Alert ─────────────────────────────────────────────────────────────

export function computeSectorAlert(
  topSector: AllocationSlice | undefined,
): BriefingAlert | null {
  if (!topSector || topSector.percentage < 35) return null;
  return {
    type: 'info',
    text: `${topSector.label} allocation ${topSector.percentage.toFixed(0)}% — above 30% target`,
  };
}

// ─── Top Mover ────────────────────────────────────────────────────────────────

export function computeTopMover(snapshotRows: SnapshotHolding[]): PortfolioMover | null {
  // Filter out option positions (OCC symbol pattern)
  const stockRows = snapshotRows.filter((h) => {
    return !isOptionSymbol(h.symbol);
  });

  if (stockRows.length === 0) return null;

  const withPct = stockRows.map((h) => {
    const prevValue = h.marketValue - h.todayPl;
    const changePercent = prevValue !== 0 ? (h.todayPl / prevValue) * 100 : 0;
    return { symbol: h.symbol, changePercent };
  });

  withPct.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
  return withPct[0] ?? null;
}

// ─── Assemble Briefing ────────────────────────────────────────────────────────

export function assembleBriefing(params: {
  snapshotRows: SnapshotHolding[];
  totalValue: number;
  totalReturnPct: number;
  dayPl: number | null;
  allocations: AllocationSlice[];
  aiHeadline: string | null;
  headlineGeneratedAt: string | null;
}): DailyBriefing {
  const { snapshotRows, totalValue, totalReturnPct, dayPl, allocations, aiHeadline, headlineGeneratedAt } = params;

  // top5Pct — top 5 non-option holdings as % of total value
  const stockRows = snapshotRows.filter((h) => {
    return !isOptionSymbol(h.symbol);
  });
  const top5Value = [...stockRows]
    .sort((a, b) => b.marketValue - a.marketValue)
    .slice(0, 5)
    .reduce((s, h) => s + h.marketValue, 0);
  const top5Pct = totalValue > 0 ? (top5Value / totalValue) * 100 : 0;

  const topSector = allocations[0];
  const topSectorPct = topSector?.percentage ?? 0;

  const { score: healthScore, label: healthLabel } = computeHealthScore({
    top5Pct,
    topSectorPct,
    totalReturnPct,
  });

  const options = parseOptionsFromSnapshot(snapshotRows);
  const { thetaToday, optionsCount, alerts: optionAlerts } = computeOptionsData(options);

  const sectorAlert = computeSectorAlert(topSector);
  const alerts = [...optionAlerts, ...(sectorAlert ? [sectorAlert] : [])].slice(0, 3);

  const topMover = computeTopMover(snapshotRows);

  const dayPlPct =
    dayPl !== null && totalValue - dayPl !== 0
      ? (dayPl / (totalValue - dayPl)) * 100
      : null;

  const unrealisedPnl = snapshotRows.reduce((s, h) => s + h.unrealizedPnl, 0);
  const costBasisTotal = snapshotRows.reduce(
    (s, h) => s + (h.marketValue - h.unrealizedPnl),
    0,
  );
  const unrealisedPnlPct = costBasisTotal > 0 ? (unrealisedPnl / costBasisTotal) * 100 : 0;

  return {
    aiHeadline,
    headlineGeneratedAt,
    healthScore,
    healthLabel,
    dayPl,
    dayPlPct,
    unrealisedPnl,
    unrealisedPnlPct,
    thetaToday,
    optionsCount,
    marketRegime: computeMarketRegime(PLACEHOLDER_VIX),
    vixLevel: PLACEHOLDER_VIX,
    topMover,
    alerts,
  };
}

// ─── AI Headline Generation ───────────────────────────────────────────────────

export async function generateBriefHeadline(
  params: {
    totalValue: number;
    healthScore: number;
    healthLabel: string;
    dayPl: number | null;
    topSectorLabel: string;
    topSectorPct: number;
    alerts: BriefingAlert[];
  },
  anthropicApiKey: string | undefined,
  claudeEnabled: boolean,
): Promise<string> {
  if (anthropicApiKey && claudeEnabled) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const dayPlStr =
        params.dayPl !== null
          ? `${params.dayPl >= 0 ? '+' : ''}$${Math.abs(params.dayPl).toFixed(2)}`
          : 'unknown';
      const alertSummary =
        params.alerts.map((a) => a.text).join('; ') || 'none';

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 80,
          messages: [
            {
              role: 'user',
              content: `Write a 1-2 sentence morning portfolio briefing. Be specific with numbers. Max 150 characters total. No greeting. No prefix.

Portfolio: value $${params.totalValue.toFixed(0)}, health ${params.healthScore}/100 (${params.healthLabel}), day P&L ${dayPlStr}, ${params.topSectorLabel} sector ${params.topSectorPct.toFixed(0)}%, alerts: ${alertSummary}.`,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          content?: { type: string; text: string }[];
        };
        const text = (data.content?.[0]?.text ?? '').trim();
        if (text.length > 0) return text.slice(0, 200);
      }
    } catch (err) {
      console.warn('[briefing] headline generation failed, using fallback:', err);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Rule-based fallback
  const parts: string[] = [
    `Portfolio health is ${params.healthLabel.toLowerCase()} at ${params.healthScore}/100.`,
  ];
  if (params.alerts.length > 0) {
    parts.push(params.alerts[0].text + '.');
  }
  return parts.join(' ');
}
