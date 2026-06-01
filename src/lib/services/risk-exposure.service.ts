import { randomUUID } from 'node:crypto';
import { prisma } from '$lib/server/db';
import {
  ANALYTICS_PERIODS,
  getAnalyticsDashboard,
  type AnalyticsPeriod,
  type DrawdownPoint,
  type ReturnPoint
} from '$lib/services/analytics.service';
import type { SnapshotHolding } from '$lib/types/portfolio';
import { uniformCurrency } from '$lib/format';

export const RISK_EXPOSURE_PERIODS = ANALYTICS_PERIODS;
export type RiskExposurePeriod = AnalyticsPeriod;

type SnapshotRow = {
  id: string;
  snapshotDate: Date;
  totalValue: number;
  cashBalance: number;
  holdingsJson: string;
};

export type RiskExposureRow = {
  key: string;
  marketValue: number;
  grossExposure: number;
  allocationPercent: number;
  riskContribution: number;
  direction: 'long' | 'short' | 'cash' | 'net';
};

export type RiskFlag = {
  severity: 'low' | 'medium' | 'high';
  category: string;
  title: string;
  detail: string;
};

export type VolatilityAnalysis = {
  status: 'ready' | 'insufficient_data';
  message: string;
  dailyVolatilityPct: number;
  annualizedVolatilityPct: number;
  rollingVolatility: Array<{ date: string; volatilityPct: number }>;
  trend: 'rising' | 'falling' | 'stable' | 'insufficient_data';
  regime: 'low' | 'moderate' | 'high' | 'insufficient_data';
};

export type DrawdownAnalysis = {
  status: 'ready' | 'insufficient_data';
  message: string;
  maxDrawdownPct: number;
  currentDrawdownPct: number;
  periods: Array<{
    startDate: string;
    troughDate: string;
    recoveryDate: string | null;
    maxDrawdownPct: number;
    daysUnderwater: number;
  }>;
  series: DrawdownPoint[];
};

export type ConcentrationAnalysis = {
  largestPositionKey: string;
  largestPositionPct: number;
  topFivePct: number;
  hhiScore: number;
  concentrationScore: number;
  shortExposurePct: number;
};

export type DiversificationAnalysis = {
  score: number;
  quality: 'well_diversified' | 'balanced' | 'concentrated' | 'insufficient_data';
  effectivePositions: number;
  matrix: Array<{
    assetA: string;
    assetB: string;
    correlationValue: number;
    method: 'exposure_proxy';
  }>;
};

export type PortfolioHealthReport = {
  healthScore: number;
  riskScore: number;
  riskLevel: 'low' | 'moderate' | 'high';
  category:
    | 'Low Risk'
    | 'Moderate Risk'
    | 'Aggressive Growth'
    | 'High Volatility'
    | 'Concentrated Portfolio'
    | 'Well Diversified';
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
};

export type RiskExposureDashboard = {
  status: 'ready' | 'insufficient_data';
  period: RiskExposurePeriod;
  snapshotDate: string | null;
  /** Display currency for monetary values (shared currency of the scoped holdings). */
  currency: string;
  risk: {
    riskScore: number;
    riskLevel: 'low' | 'moderate' | 'high';
    volatility: VolatilityAnalysis;
    drawdown: DrawdownAnalysis;
    concentration: ConcentrationAnalysis;
    diversification: DiversificationAnalysis;
    flags: RiskFlag[];
  };
  exposure: {
    byPosition: RiskExposureRow[];
    bySector: RiskExposureRow[];
    byCountry: RiskExposureRow[];
    byCurrency: RiskExposureRow[];
    byBroker: RiskExposureRow[];
    byAccount: RiskExposureRow[];
    byAssetType: RiskExposureRow[];
  };
  health: PortfolioHealthReport;
  cache: {
    cacheKey: string;
    generatedAt: string;
    expiresAt: string;
  };
};

const TRADING_DAYS = 252;

export async function getRiskExposureDashboard(
  userId: string,
  brokerAccId: string | null = null,
  period: RiskExposurePeriod = 'MAX',
  forceRefresh = false
): Promise<RiskExposureDashboard> {
  const cacheKey = `phase3b:risk_exposure:v6:${userId}:${brokerAccId ?? 'all'}:${period}`;
  if (!forceRefresh) {
    const cached = await readRiskExposureCache(cacheKey);
    if (cached) return cached;
  }

  const [analytics, snapshots] = await Promise.all([
    getAnalyticsDashboard(userId, brokerAccId, period, 'SPY'),
    prisma.portfolioSnapshot.findMany({
      where: { userId, ...(brokerAccId !== null ? { brokerAccId } : {}) },
      orderBy: { snapshotDate: 'asc' }
    })
  ]);
  const latest = snapshots.at(-1) ?? null;
  const rawHoldings = parseHoldings(latest?.holdingsJson);

  // Enrich holdings with sector/country from the asset table. Match on a
  // canonical key because synced holdings use moomoo format (HK.00005) while
  // seeded assets use Yahoo format (0005.HK) — the same security, different string.
  const assetMeta = rawHoldings.length
    ? await prisma.asset.findMany({ select: { symbol: true, sector: true, country: true } })
    : [];
  // Merge duplicates that canonicalise to the same key (e.g. bare "SCHG" and
  // "US.SCHG"), preferring populated sector/country so a null-field duplicate
  // can't clobber a good one.
  const metaMap = new Map<string, { sector: string | null; country: string | null }>();
  for (const a of assetMeta) {
    const key = canonicalSymbol(a.symbol);
    const prev = metaMap.get(key);
    metaMap.set(key, {
      sector: a.sector ?? prev?.sector ?? null,
      country: a.country ?? prev?.country ?? null,
    });
  }
  const holdings = rawHoldings.map((h) => {
    const meta = metaMap.get(canonicalSymbol(h.symbol));
    return {
      ...h,
      sector: h.sector || meta?.sector || null,
      country: h.country || meta?.country || null,
    };
  });

  const exposure = buildExposure(holdings, latest?.cashBalance ?? 0);
  const volatility = buildVolatility(analytics.dailyReturns);
  const drawdown = buildDrawdown(analytics.drawdownSeries);
  const concentration = buildConcentration(exposure.byPosition);
  const diversification = buildDiversification(holdings, concentration);
  const flags = buildRiskFlags({
    exposure,
    volatility,
    drawdown,
    concentration,
    snapshotCount: analytics.summary.snapshotCount,
    cashRatio: analytics.summary.cashRatio
  });
  const health = buildHealthReport({ volatility, drawdown, concentration, diversification, flags });

  const dashboard: RiskExposureDashboard = {
    status: latest ? 'ready' : 'insufficient_data',
    period,
    snapshotDate: latest ? isoDate(latest.snapshotDate) : null,
    currency: uniformCurrency(holdings.map((holding) => holding.currency)),
    risk: {
      riskScore: health.riskScore,
      riskLevel: health.riskLevel,
      volatility,
      drawdown,
      concentration,
      diversification,
      flags
    },
    exposure,
    health,
    cache: {
      cacheKey,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString()
    }
  };

  await writeRiskExposureCache(userId, cacheKey, dashboard);
  return dashboard;
}

export async function refreshRiskExposure(
  userId: string,
  brokerAccId: string | null = null,
  period: RiskExposurePeriod = 'MAX'
) {
  return getRiskExposureDashboard(userId, brokerAccId, period, true);
}

export function parseRiskExposurePeriod(value: string | null): RiskExposurePeriod {
  return RISK_EXPOSURE_PERIODS.includes(value as RiskExposurePeriod) ? (value as RiskExposurePeriod) : 'MAX';
}

function buildVolatility(returns: ReturnPoint[]): VolatilityAnalysis {
  const values = returns.map((point) => point.returnPct / 100).filter(Number.isFinite);
  const dailyVolatility = standardDeviation(values);
  const annualizedVolatility = dailyVolatility * Math.sqrt(TRADING_DAYS);
  const rollingVolatility = rolling(values, 5).map((volatility, index) => ({
    date: returns[index + 4]?.date ?? returns.at(-1)?.date ?? '',
    volatilityPct: volatility * Math.sqrt(TRADING_DAYS) * 100
  }));
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  const firstVol = standardDeviation(firstHalf);
  const secondVol = standardDeviation(secondHalf);
  const trend =
    values.length < 6
      ? 'insufficient_data'
      : secondVol > firstVol * 1.15
        ? 'rising'
        : secondVol < firstVol * 0.85
          ? 'falling'
          : 'stable';
  const annualizedVolatilityPct = annualizedVolatility * 100;
  const regime =
    values.length < 2
      ? 'insufficient_data'
      : annualizedVolatilityPct < 12
        ? 'low'
        : annualizedVolatilityPct < 25
          ? 'moderate'
          : 'high';

  return {
    status: values.length >= 2 ? 'ready' : 'insufficient_data',
    message:
      values.length >= 2
        ? 'Volatility calculated from snapshot daily returns.'
        : 'Need at least 2 daily return points for volatility analysis.',
    dailyVolatilityPct: dailyVolatility * 100,
    annualizedVolatilityPct,
    rollingVolatility,
    trend,
    regime
  };
}

function buildDrawdown(series: DrawdownPoint[]): DrawdownAnalysis {
  const maxDrawdownPct = Math.min(0, ...series.map((point) => point.drawdownPct));
  const currentDrawdownPct = series.at(-1)?.drawdownPct ?? 0;

  return {
    status: series.length >= 2 ? 'ready' : 'insufficient_data',
    message:
      series.length >= 2
        ? 'Drawdown calculated from portfolio snapshot equity curve.'
        : 'Need at least 2 snapshots for drawdown analysis.',
    maxDrawdownPct,
    currentDrawdownPct,
    periods: drawdownPeriods(series),
    series
  };
}

function buildExposure(holdings: SnapshotHolding[], cashBalance: number): RiskExposureDashboard['exposure'] {
  const positionRows = holdings.map((holding) => ({
    key: holding.symbol,
    marketValue: holding.marketValue,
    grossValue: Math.abs(holding.marketValue),
    direction: holding.marketValue < 0 ? 'short' : 'long',
    sector: holding.sector || sectorFallback(holding.symbol, holding.assetType),
    country: normalizeCountry(holding.country) || countryFromSymbol(holding.symbol),
    currency: holding.currency || 'USD',
    broker: holding.brokerName || holding.accountName || 'Manual',
    account: holding.accountName || 'Default account',
    assetType: holding.assetType || assetTypeFromSymbol(holding.symbol)
  }));
  if (cashBalance > 0) {
    positionRows.push({
      key: 'Cash',
      marketValue: cashBalance,
      grossValue: cashBalance,
      direction: 'cash',
      sector: 'Cash',
      country: 'Cash',
      currency: 'USD',
      broker: 'Cash',
      account: 'Cash',
      assetType: 'cash'
    });
  }

  return {
    byPosition: rowsFromValues(positionRows.map((row) => [row.key, row.marketValue, row.direction])),
    bySector: groupRows(positionRows, (row) => row.sector),
    byCountry: groupRows(positionRows, (row) => row.country),
    byCurrency: groupRows(positionRows, (row) => row.currency),
    byBroker: groupRows(positionRows, (row) => row.broker),
    byAccount: groupRows(positionRows, (row) => row.account),
    byAssetType: groupRows(positionRows, (row) => row.assetType)
  };
}

function buildConcentration(positionRows: RiskExposureRow[]): ConcentrationAnalysis {
  const sorted = [...positionRows].sort((a, b) => b.grossExposure - a.grossExposure);
  const largest = sorted[0];
  const hhi = sorted.reduce((sum, row) => sum + (row.allocationPercent / 100) ** 2, 0);
  const shortExposurePct = sorted
    .filter((row) => row.direction === 'short')
    .reduce((sum, row) => sum + row.allocationPercent, 0);
  const concentrationScore = clamp(100 - Math.max((largest?.allocationPercent ?? 0) - 20, 0) * 1.5 - hhi * 35, 0, 100);

  return {
    largestPositionKey: largest?.key ?? '',
    largestPositionPct: largest?.allocationPercent ?? 0,
    topFivePct: sorted.slice(0, 5).reduce((sum, row) => sum + row.allocationPercent, 0),
    hhiScore: hhi * 100,
    concentrationScore,
    shortExposurePct
  };
}

function buildDiversification(
  holdings: SnapshotHolding[],
  concentration: ConcentrationAnalysis
): DiversificationAnalysis {
  const matrix = buildCorrelationMatrix(holdings);
  const score = clamp(100 - concentration.hhiScore * 1.2 - Math.max(concentration.largestPositionPct - 25, 0), 0, 100);
  const effectivePositions = concentration.hhiScore > 0 ? 100 / concentration.hhiScore : holdings.length;
  const quality =
    holdings.length === 0
      ? 'insufficient_data'
      : score >= 75
        ? 'well_diversified'
        : score >= 50
          ? 'balanced'
          : 'concentrated';

  return { score, quality, effectivePositions, matrix };
}

function buildRiskFlags(input: {
  exposure: RiskExposureDashboard['exposure'];
  volatility: VolatilityAnalysis;
  drawdown: DrawdownAnalysis;
  concentration: ConcentrationAnalysis;
  snapshotCount: number;
  cashRatio: number;
}): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const largestSector = input.exposure.bySector[0];
  const largestCountry = input.exposure.byCountry[0];

  if (input.concentration.largestPositionPct > 25) {
    flags.push({
      severity: input.concentration.largestPositionPct > 50 ? 'high' : 'medium',
      category: 'concentration',
      title: 'Single-position concentration',
      detail: `${input.concentration.largestPositionKey} is ${round(input.concentration.largestPositionPct)}% of gross exposure.`
    });
  }
  if (largestSector && largestSector.allocationPercent > 40) {
    flags.push({
      severity: largestSector.allocationPercent > 60 ? 'high' : 'medium',
      category: 'sector',
      title: 'Sector concentration',
      detail: `${largestSector.key} exposure is ${round(largestSector.allocationPercent)}%.`
    });
  }
  if (largestCountry && largestCountry.allocationPercent > 80 && largestCountry.key !== 'Cash') {
    flags.push({
      severity: 'medium',
      category: 'country',
      title: 'Country concentration',
      detail: `${largestCountry.key} exposure is ${round(largestCountry.allocationPercent)}%.`
    });
  }
  if (input.cashRatio < 2) {
    flags.push({
      severity: 'medium',
      category: 'liquidity',
      title: 'Low cash buffer',
      detail: `Cash is ${round(input.cashRatio)}% of portfolio value.`
    });
  }
  if (input.concentration.shortExposurePct > 20) {
    flags.push({
      severity: 'medium',
      category: 'short_exposure',
      title: 'Short exposure',
      detail: `Short or negative-value positions are ${round(input.concentration.shortExposurePct)}% of gross exposure.`
    });
  }
  if (input.volatility.regime === 'high') {
    flags.push({
      severity: 'high',
      category: 'volatility',
      title: 'High volatility regime',
      detail: `Annualized volatility is ${round(input.volatility.annualizedVolatilityPct)}%.`
    });
  }
  if (input.drawdown.maxDrawdownPct < -15) {
    flags.push({
      severity: input.drawdown.maxDrawdownPct < -30 ? 'high' : 'medium',
      category: 'drawdown',
      title: 'Drawdown pressure',
      detail: `Max drawdown is ${round(input.drawdown.maxDrawdownPct)}%.`
    });
  }
  if (input.snapshotCount < 3) {
    flags.push({
      severity: 'low',
      category: 'data_quality',
      title: 'Limited risk history',
      detail: 'Need at least 3 snapshots for more reliable volatility, drawdown, and correlation risk.'
    });
  }

  return flags;
}

function buildHealthReport(input: {
  volatility: VolatilityAnalysis;
  drawdown: DrawdownAnalysis;
  concentration: ConcentrationAnalysis;
  diversification: DiversificationAnalysis;
  flags: RiskFlag[];
}): PortfolioHealthReport {
  let riskScore = 100;
  riskScore -= Math.max(input.concentration.largestPositionPct - 20, 0) * 0.8;
  riskScore -= Math.max(input.volatility.annualizedVolatilityPct - 18, 0) * 0.8;
  riskScore -= Math.abs(Math.min(input.drawdown.maxDrawdownPct, 0)) * 0.7;
  riskScore -= Math.max(60 - input.diversification.score, 0) * 0.5;
  riskScore -= input.flags.filter((flag) => flag.severity === 'high').length * 8;
  riskScore -= input.flags.filter((flag) => flag.severity === 'medium').length * 4;
  riskScore = clamp(riskScore, 0, 100);

  const riskLevel = riskScore >= 75 ? 'low' : riskScore >= 50 ? 'moderate' : 'high';
  const category =
    input.diversification.quality === 'well_diversified'
      ? 'Well Diversified'
      : input.concentration.largestPositionPct > 35
        ? 'Concentrated Portfolio'
        : input.volatility.regime === 'high'
          ? 'High Volatility'
          : riskLevel === 'low'
            ? 'Low Risk'
            : riskLevel === 'moderate'
              ? 'Moderate Risk'
              : 'Aggressive Growth';

  const strengths: string[] = [];
  const weaknesses = input.flags.map((flag) => flag.detail).slice(0, 5);
  if (input.concentration.largestPositionPct <= 25) strengths.push('Single-position concentration is within the risk rule threshold.');
  if (input.diversification.score >= 60) strengths.push('Diversification score is balanced or better.');
  if (input.drawdown.currentDrawdownPct === 0) strengths.push('Portfolio is currently at or near its snapshot equity high.');
  if (input.volatility.regime === 'low' || input.volatility.regime === 'moderate') strengths.push(`Volatility regime is ${input.volatility.regime}.`);

  return {
    healthScore: riskScore,
    riskScore,
    riskLevel,
    category,
    strengths: strengths.slice(0, 5),
    weaknesses,
    recommendations: input.flags
      .filter((flag) => flag.severity !== 'low')
      .map((flag) => `Review ${flag.category.replaceAll('_', ' ')}: ${flag.title}.`)
      .slice(0, 5)
  };
}

function groupRows<T extends { marketValue: number; direction: string }>(rows: T[], key: (row: T) => string): RiskExposureRow[] {
  const groups = new Map<string, { marketValue: number; grossValue: number; shortValue: number }>();
  for (const row of rows) {
    const label = key(row) || 'Unknown';
    const existing = groups.get(label) ?? { marketValue: 0, grossValue: 0, shortValue: 0 };
    existing.marketValue += row.marketValue;
    existing.grossValue += Math.abs(row.marketValue);
    if (row.marketValue < 0) existing.shortValue += Math.abs(row.marketValue);
    groups.set(label, existing);
  }
  return exposureRowsFromGroups(groups);
}

function rowsFromValues(rows: Array<[string, number, string]>): RiskExposureRow[] {
  const groups = new Map<string, { marketValue: number; grossValue: number; shortValue: number; direction?: string }>();
  for (const [key, marketValue, direction] of rows) {
    groups.set(key, {
      marketValue,
      grossValue: Math.abs(marketValue),
      shortValue: marketValue < 0 ? Math.abs(marketValue) : 0,
      direction
    });
  }
  return exposureRowsFromGroups(groups);
}

function exposureRowsFromGroups(
  groups: Map<string, { marketValue: number; grossValue: number; shortValue: number; direction?: string }>
): RiskExposureRow[] {
  const grossTotal = [...groups.values()].reduce((sum, row) => sum + row.grossValue, 0);
  return [...groups.entries()]
    .map(([key, row]) => {
      const direction =
        row.direction === 'cash'
          ? 'cash'
          : row.marketValue < 0
            ? 'short'
            : row.shortValue > 0 && row.marketValue !== row.grossValue
              ? 'net'
              : 'long';
      const allocationPercent = grossTotal > 0 ? (row.grossValue / grossTotal) * 100 : 0;
      return {
        key,
        marketValue: row.marketValue,
        grossExposure: row.grossValue,
        allocationPercent,
        riskContribution: allocationPercent,
        direction
      } as RiskExposureRow;
    })
    .sort((a, b) => b.grossExposure - a.grossExposure);
}

function drawdownPeriods(series: DrawdownPoint[]) {
  const periods: DrawdownAnalysis['periods'] = [];
  let current: DrawdownAnalysis['periods'][number] | null = null;

  for (const point of series) {
    if (point.drawdownPct < 0 && !current) {
      current = {
        startDate: point.date,
        troughDate: point.date,
        recoveryDate: null,
        maxDrawdownPct: point.drawdownPct,
        daysUnderwater: 0
      };
    }
    if (current && point.drawdownPct < current.maxDrawdownPct) {
      current.maxDrawdownPct = point.drawdownPct;
      current.troughDate = point.date;
    }
    if (current && point.drawdownPct === 0) {
      current.recoveryDate = point.date;
      current.daysUnderwater = daysBetween(current.startDate, point.date);
      periods.push(current);
      current = null;
    }
  }

  if (current) {
    current.daysUnderwater = daysBetween(current.startDate, series.at(-1)?.date ?? current.startDate);
    periods.push(current);
  }

  return periods;
}

function buildCorrelationMatrix(holdings: SnapshotHolding[]) {
  const rows = holdings.slice(0, 10);
  const matrix: DiversificationAnalysis['matrix'] = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i];
      const b = rows[j];
      let correlationValue = 0.2;
      if ((a.sector || '') && a.sector === b.sector) correlationValue += 0.3;
      if (countryFromSymbol(a.symbol) === countryFromSymbol(b.symbol)) correlationValue += 0.2;
      if ((a.assetType || assetTypeFromSymbol(a.symbol)) === (b.assetType || assetTypeFromSymbol(b.symbol))) correlationValue += 0.15;
      matrix.push({
        assetA: a.symbol,
        assetB: b.symbol,
        correlationValue: clamp(correlationValue, 0, 0.95),
        method: 'exposure_proxy'
      });
    }
  }
  return matrix;
}

function rolling(values: number[], windowSize: number) {
  const rows: number[] = [];
  for (let index = windowSize; index <= values.length; index += 1) {
    rows.push(standardDeviation(values.slice(index - windowSize, index)));
  }
  return rows;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function parseHoldings(json: string | undefined): SnapshotHolding[] {
  try {
    const rows = JSON.parse(json ?? '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function countryFromSymbol(symbol: string) {
  const market = symbol.split('.', 1)[0]?.toUpperCase();
  if (market === 'US') return 'United States';
  if (market === 'HK') return 'Hong Kong';
  if (market === 'MY') return 'Malaysia';
  if (market === 'SG') return 'Singapore';
  if (market === 'SH' || market === 'SZ' || market === 'CN') return 'China';
  return 'Unknown country';
}

/**
 * Normalise stored country values (often ISO codes like "US"/"HK") to the same
 * full-name form `countryFromSymbol` produces, so e.g. an ETF stored as "US"
 * and an option derived as "United States" collapse into one exposure bucket.
 * Returns null for empty input so callers can fall back to the symbol.
 */
function normalizeCountry(country: string | null | undefined): string | null {
  if (!country) return null;
  const c = country.trim().toUpperCase();
  if (c === 'US' || c === 'USA' || c === 'UNITED STATES') return 'United States';
  if (c === 'HK' || c === 'HONG KONG') return 'Hong Kong';
  if (c === 'MY' || c === 'MALAYSIA') return 'Malaysia';
  if (c === 'SG' || c === 'SINGAPORE') return 'Singapore';
  if (c === 'SH' || c === 'SZ' || c === 'CN' || c === 'CHINA') return 'China';
  return country;
}

function assetTypeFromSymbol(symbol: string) {
  return /\d{6}[CP]\d+$/i.test(symbol.split('.').at(-1) ?? '') ? 'option' : 'stock';
}

/**
 * Canonical "MARKET:CODE" key so the same security matches across symbol
 * formats — moomoo prefix (HK.00005, US.AAPL) vs Yahoo suffix (0005.HK) vs bare
 * (AAPL). Numeric codes are stripped of leading zeros (HK 00005 ↔ 0005).
 */
function canonicalSymbol(symbol: string): string {
  const s = (symbol || '').trim().toUpperCase();
  let market = '';
  let code = '';
  const prefix = s.match(/^(US|HK|SH|SZ|SG|MY|CN)\.(.+)$/);
  const suffix = s.match(/^(.+)\.(HK|KL|SI|SS|SZ)$/);
  if (prefix) {
    market = prefix[1];
    code = prefix[2];
  } else if (suffix) {
    code = suffix[1];
    market = { HK: 'HK', KL: 'MY', SI: 'SG', SS: 'SH', SZ: 'SZ' }[suffix[2]] ?? suffix[2];
  } else {
    market = 'US';
    code = s;
  }
  if (/^\d+$/.test(code)) code = String(parseInt(code, 10));
  return `${market}:${code}`;
}

/**
 * Sector label when a holding has no equity sector (ETFs, options, etc.).
 * Buckets by asset type so option contracts show as "Options" rather than the
 * meaningless "Unknown sector".
 */
function sectorFallback(symbol: string, assetType: string | null | undefined): string {
  const type = (assetType || assetTypeFromSymbol(symbol)).toLowerCase();
  if (type === 'option') return 'Options';
  if (type === 'etf') return 'ETF';
  if (type === 'cash') return 'Cash';
  return 'Unknown sector';
}

async function readRiskExposureCache(cacheKey: string): Promise<RiskExposureDashboard | null> {
  try {
    const row = await prisma.analyticsCache.findUnique({ where: { cacheKey } });
    if (!row || row.expiresAt <= new Date()) return null;
    return JSON.parse(row.payloadJson) as RiskExposureDashboard;
  } catch {
    return null;
  }
}

async function writeRiskExposureCache(userId: string, cacheKey: string, dashboard: RiskExposureDashboard) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60_000);
  try {
    await prisma.analyticsCache.upsert({
      where: { cacheKey },
      create: {
        id: randomUUID(),
        userId,
        cacheKey,
        cacheType: 'phase3b_risk_exposure',
        payloadJson: JSON.stringify(dashboard),
        generatedAt: now,
        expiresAt
      },
      update: {
        payloadJson: JSON.stringify(dashboard),
        generatedAt: now,
        expiresAt
      }
    });
  } catch {
    // Risk cache is an optimization; endpoint should still return calculated data.
  }
}

function daysBetween(start: string, end: string) {
  return Math.max(0, Math.round((new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
