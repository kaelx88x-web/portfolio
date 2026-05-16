import { randomUUID } from 'node:crypto';
import { prisma } from '$lib/server/db';
import { getHistoricalCandles, type HistoricalCandle } from '$lib/services/broker.service';
import type { AllocationSlice, SnapshotHolding } from '$lib/types/portfolio';

export const ANALYTICS_PERIODS = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', 'MAX'] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export const BENCHMARKS = ['SPY', 'QQQ', 'VOO', 'DIA', 'SCHG', 'SCHD', 'VT'] as const;
export type AnalyticsBenchmark = (typeof BENCHMARKS)[number];

const BENCHMARK_CODES: Record<AnalyticsBenchmark, string> = {
  SPY: 'US.SPY',
  QQQ: 'US.QQQ',
  VOO: 'US.VOO',
  DIA: 'US.DIA',
  SCHG: 'US.SCHG',
  SCHD: 'US.SCHD',
  VT: 'US.VT'
};

const RISK_FREE_RATE = 0.04;
const TRADING_DAYS = 252;

type SnapshotRow = {
  id: string;
  snapshotDate: Date;
  totalValue: number;
  cashBalance: number;
  holdingsCount: number;
  holdingsJson: string;
  allocationJson: string;
};

type TransactionRow = {
  type: string;
  quantity: number;
  price: number;
  fee: number;
  tradeDate: Date;
};

type ExternalFlows = {
  inflow: number;
  outflow: number;
  net: number;
};

export type AnalyticsPoint = {
  date: string;
  value: number;
  returnPct: number;
};

export type ReturnPoint = {
  date: string;
  returnPct: number;
};

export type DrawdownPoint = {
  date: string;
  drawdownPct: number;
};

export type AnalyticsSummary = {
  status: 'ready' | 'insufficient_data';
  message: string;
  period: AnalyticsPeriod;
  portfolioValue: number;
  investedValue: number;
  cashBalance: number;
  netContribution: number;
  cashRatio: number;
  totalReturnPct: number;
  dailyReturnPct: number;
  weeklyReturnPct: number;
  monthlyReturnPct: number;
  mtdReturnPct: number;
  ytdReturnPct: number;
  cagrPct: number;
  unrealizedPnl: number;
  incomeTotal: number;
  snapshotCount: number;
  firstSnapshotDate: string | null;
  latestSnapshotDate: string | null;
};

export type RiskMetrics = {
  status: 'ready' | 'insufficient_data';
  message: string;
  volatilityPct: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  beta: number;
  alphaPct: number;
  correlationToBenchmarkPct: number;
  valueAtRisk95Pct: number;
  concentrationRiskPct: number;
  largestHoldingSymbol: string;
};

export type BenchmarkComparison = {
  benchmark: AnalyticsBenchmark;
  status: 'ready' | 'insufficient_data';
  message: string;
  portfolioReturnPct: number;
  benchmarkReturnPct: number;
  alphaPct: number;
  beta: number;
  correlationPct: number;
  relativeVolatilityPct: number;
  relativeDrawdownPct: number;
  outperformancePct: number;
  outperformed: boolean;
};

export type AllocationDriftRow = {
  label: string;
  currentPct: number;
  targetPct: number;
  driftPct: number;
  value: number;
};

export type ExposureAnalysis = {
  bySector: AllocationSlice[];
  byCountry: AllocationSlice[];
  byCurrency: AllocationSlice[];
  byBroker: AllocationSlice[];
  positionConcentration: AllocationSlice[];
};

export type CorrelationAnalysis = {
  status: 'ready' | 'insufficient_data';
  message: string;
  portfolioBenchmarkCorrelationPct: number;
  diversificationScore: number;
  matrix: Array<{ asset: string; portfolioWeightPct: number; correlationToPortfolioPct: number }>;
};

export type PortfolioHealth = {
  score: number;
  riskLevel: 'low' | 'moderate' | 'high';
  label: string;
  strengths: string[];
  weaknesses: string[];
};

export type IncomePoint = {
  month: string;
  dividend: number;
  interest: number;
  total: number;
};

export type TopContributor = {
  symbol: string;
  name: string;
  assetType: string;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
};

export type AnalyticsDashboard = {
  summary: AnalyticsSummary;
  risk: RiskMetrics;
  benchmark: BenchmarkComparison;
  health: PortfolioHealth;
  exposure: ExposureAnalysis;
  correlation: CorrelationAnalysis;
  valueSeries: AnalyticsPoint[];
  dailyReturns: ReturnPoint[];
  weeklyReturns: ReturnPoint[];
  monthlyReturns: ReturnPoint[];
  drawdownSeries: DrawdownPoint[];
  allocation: {
    bySymbol: AllocationSlice[];
    byAssetType: AllocationSlice[];
    byCurrency: AllocationSlice[];
    drift: AllocationDriftRow[];
  };
  income: {
    total: number;
    byMonth: IncomePoint[];
  };
  topContributors: {
    gainers: TopContributor[];
    losers: TopContributor[];
  };
  cache: {
    cacheKey: string;
    generatedAt: string;
    expiresAt: string;
  };
};

export async function getAnalyticsDashboard(
  userId: string,
  period: AnalyticsPeriod = 'MAX',
  benchmark: AnalyticsBenchmark = 'SPY'
): Promise<AnalyticsDashboard> {
  const cacheKey = `phase3a:v3:${userId}:${period}:${benchmark}`;
  const cached = await readAnalyticsCache(cacheKey);
  if (cached) return cached;

  const [snapshots, transactions] = await Promise.all([
    prisma.portfolioSnapshot.findMany({
      where: { userId },
      orderBy: { snapshotDate: 'asc' }
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { tradeDate: 'asc' }
    })
  ]);

  const periodSnapshots = filterSnapshotsByPeriod(snapshots, period);
  const latest = periodSnapshots.at(-1) ?? snapshots.at(-1) ?? null;
  const first = periodSnapshots[0] ?? latest;
  const previous = periodSnapshots.length > 1 ? (periodSnapshots.at(-2) ?? null) : null;
  const latestHoldings = await enrichHoldings(parseHoldings(latest?.holdingsJson));
  const valueSeries = buildValueSeries(periodSnapshots, transactions);
  const dailyReturns = buildDailyReturns(periodSnapshots, transactions);
  const weeklyReturns = aggregateReturns(dailyReturns, 'week');
  const monthlyReturns = aggregateReturns(dailyReturns, 'month');
  const drawdownSeries = buildDrawdownSeries(periodSnapshots);
  const income = buildIncome(transactions.filter((transaction) => ['dividend', 'interest'].includes(transaction.type)));
  const benchmarkAnalysis = await buildBenchmark(benchmark, first, latest, transactions, dailyReturns, drawdownSeries);
  const risk = buildRisk(periodSnapshots, latestHoldings, dailyReturns, drawdownSeries, benchmarkAnalysis);
  const exposure = buildExposure(latestHoldings);
  const correlation = buildCorrelation(latestHoldings, benchmarkAnalysis);
  const health = buildPortfolioHealth(risk, exposure, correlation, periodSnapshots.length);

  const dashboard: AnalyticsDashboard = {
    summary: buildSummary({
      period,
      first,
      latest,
      previous,
      snapshots: periodSnapshots,
      latestHoldings,
      transactions,
      incomeTotal: income.total,
      weeklyReturns,
      monthlyReturns
    }),
    risk,
    benchmark: benchmarkAnalysis.comparison,
    health,
    exposure,
    correlation,
    valueSeries,
    dailyReturns,
    weeklyReturns,
    monthlyReturns,
    drawdownSeries,
    allocation: buildAllocation(latest, latestHoldings),
    income,
    topContributors: buildTopContributors(latestHoldings),
    cache: {
      cacheKey,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString()
    }
  };

  await writeAnalyticsArtifacts(userId, cacheKey, dashboard);
  return dashboard;
}

function filterSnapshotsByPeriod(snapshots: SnapshotRow[], period: AnalyticsPeriod) {
  if (period === 'MAX' || snapshots.length === 0) return snapshots;

  const latest = snapshots.at(-1);
  if (!latest) return snapshots;

  const start = new Date(latest.snapshotDate);
  if (period === 'YTD') {
    start.setUTCMonth(0, 1);
    start.setUTCHours(0, 0, 0, 0);
  } else {
    const days = {
      '1D': 1,
      '1W': 7,
      '1M': 31,
      '3M': 92,
      '6M': 183,
      '1Y': 365,
      '3Y': 365 * 3,
      '5Y': 365 * 5
    }[period];
    start.setUTCDate(start.getUTCDate() - days);
  }

  return snapshots.filter((snapshot) => snapshot.snapshotDate >= start);
}

function buildSummary(input: {
  period: AnalyticsPeriod;
  first: SnapshotRow | null;
  latest: SnapshotRow | null;
  previous: SnapshotRow | null;
  snapshots: SnapshotRow[];
  latestHoldings: SnapshotHolding[];
  transactions: TransactionRow[];
  incomeTotal: number;
  weeklyReturns: ReturnPoint[];
  monthlyReturns: ReturnPoint[];
}): AnalyticsSummary {
  const { period, first, latest, previous, snapshots, latestHoldings, transactions, incomeTotal, weeklyReturns, monthlyReturns } = input;
  const portfolioValue = latest?.totalValue ?? 0;
  const cashBalance = latest?.cashBalance ?? 0;
  const investedValue = Math.max(portfolioValue - cashBalance, 0);
  const firstValue = first?.totalValue ?? 0;
  const unrealizedPnl = latestHoldings.reduce((sum, holding) => sum + holding.unrealizedPnl, 0);
  const periodFlows = externalFlows(transactions, first?.snapshotDate ?? null, latest?.snapshotDate ?? null);
  const netContribution = latest ? netExternalContribution(transactions, latest.snapshotDate, portfolioValue) : 0;
  const totalReturnPct =
    period === 'MAX' && netContribution > 0
      ? returnPct(netContribution, portfolioValue)
      : flowAdjustedReturnPct(firstValue, portfolioValue, periodFlows);

  return {
    status: snapshots.length >= 2 ? 'ready' : 'insufficient_data',
    message:
      snapshots.length >= 2
        ? 'Analytics calculated from portfolio snapshots with risk extensions.'
        : 'Need at least 2 portfolio snapshots to calculate period returns.',
    period,
    portfolioValue,
    investedValue,
    cashBalance,
    netContribution,
    cashRatio: percentage(cashBalance, portfolioValue),
    totalReturnPct,
    dailyReturnPct: previous
      ? flowAdjustedReturnPct(
          previous.totalValue,
          portfolioValue,
          externalFlows(transactions, previous.snapshotDate, latest?.snapshotDate ?? null)
        )
      : 0,
    weeklyReturnPct: weeklyReturns.at(-1)?.returnPct ?? 0,
    monthlyReturnPct: monthlyReturns.at(-1)?.returnPct ?? 0,
    mtdReturnPct: returnFromBoundary(snapshots, latest, startOfMonth(latest?.snapshotDate), transactions),
    ytdReturnPct: returnFromBoundary(snapshots, latest, startOfYear(latest?.snapshotDate), transactions),
    cagrPct: cagr(first?.snapshotDate, latest?.snapshotDate, firstValue, portfolioValue),
    unrealizedPnl,
    incomeTotal,
    snapshotCount: snapshots.length,
    firstSnapshotDate: first ? isoDate(first.snapshotDate) : null,
    latestSnapshotDate: latest ? isoDate(latest.snapshotDate) : null
  };
}

function buildRisk(
  snapshots: SnapshotRow[],
  holdings: SnapshotHolding[],
  dailyReturns: ReturnPoint[],
  drawdownSeries: DrawdownPoint[],
  benchmarkAnalysis: BenchmarkAnalysis
): RiskMetrics {
  const returnValues = dailyReturns.map((point) => point.returnPct / 100);
  const volatility = returnValues.length >= 2 ? standardDeviation(returnValues) * Math.sqrt(TRADING_DAYS) : 0;
  const downside = returnValues.filter((value) => value < 0);
  const downsideDeviation = downside.length >= 2 ? standardDeviation(downside) * Math.sqrt(TRADING_DAYS) : 0;
  const annualizedReturn = returnValues.length > 0 ? average(returnValues) * TRADING_DAYS : 0;
  const maxDrawdown = Math.min(0, ...drawdownSeries.map((point) => point.drawdownPct));
  const totalValue = holdings.reduce((sum, holding) => sum + Math.max(holding.marketValue, 0), 0);
  const largest = [...holdings].sort((a, b) => Math.max(b.marketValue, 0) - Math.max(a.marketValue, 0))[0];

  return {
    status: snapshots.length >= 3 ? 'ready' : 'insufficient_data',
    message:
      snapshots.length >= 3
        ? 'Risk metrics calculated from daily snapshot returns, benchmark covariance, and concentration exposure.'
        : 'Need at least 3 snapshots to calculate volatility, Sharpe, Sortino, beta, and VaR.',
    volatilityPct: volatility * 100,
    maxDrawdownPct: maxDrawdown,
    sharpeRatio: volatility > 0 ? (annualizedReturn - RISK_FREE_RATE) / volatility : 0,
    sortinoRatio: downsideDeviation > 0 ? (annualizedReturn - RISK_FREE_RATE) / downsideDeviation : 0,
    beta: benchmarkAnalysis.beta,
    alphaPct: benchmarkAnalysis.capmAlphaPct,
    correlationToBenchmarkPct: benchmarkAnalysis.correlationPct,
    valueAtRisk95Pct: valueAtRisk95(returnValues) * 100,
    concentrationRiskPct: percentage(largest?.marketValue ?? 0, totalValue),
    largestHoldingSymbol: largest?.symbol ?? ''
  };
}

type BenchmarkAnalysis = {
  comparison: BenchmarkComparison;
  benchmarkReturns: ReturnPoint[];
  beta: number;
  capmAlphaPct: number;
  correlationPct: number;
  benchmarkVolatilityPct: number;
  benchmarkMaxDrawdownPct: number;
};

async function buildBenchmark(
  benchmark: AnalyticsBenchmark,
  first: SnapshotRow | null,
  latest: SnapshotRow | null,
  transactions: TransactionRow[],
  portfolioReturns: ReturnPoint[],
  portfolioDrawdown: DrawdownPoint[]
): Promise<BenchmarkAnalysis> {
  const periodFlows = externalFlows(transactions, first?.snapshotDate ?? null, latest?.snapshotDate ?? null);
  const portfolioReturnPct = flowAdjustedReturnPct(first?.totalValue ?? 0, latest?.totalValue ?? 0, periodFlows);
  const start = first ? isoDate(first.snapshotDate) : null;
  const end = latest ? isoDate(latest.snapshotDate) : null;
  const empty = emptyBenchmarkAnalysis(benchmark, portfolioReturnPct);

  if (!start || !end || start === end) {
    return {
      ...empty,
      comparison: {
        ...empty.comparison,
        message: 'Need at least 2 dated snapshots for benchmark comparison.'
      }
    };
  }

  try {
    const candles = await getHistoricalCandles(BENCHMARK_CODES[benchmark], start, end);
    const validCandles = candles.filter((candle) => Number(candle.close) > 0);
    const firstCandle = validCandles[0];
    const latestCandle = validCandles.at(-1);

    if (!firstCandle || !latestCandle || validCandles.length < 2) {
      return {
        ...empty,
        comparison: {
          ...empty.comparison,
          message: `No Moomoo historical candles available for ${BENCHMARK_CODES[benchmark]} in this period.`
        }
      };
    }

    const benchmarkReturns = buildCandleReturns(validCandles);
    const aligned = alignReturns(portfolioReturns, benchmarkReturns);
    const portfolioReturnValues = aligned.map((row) => row.portfolio / 100);
    const benchmarkReturnValues = aligned.map((row) => row.benchmark / 100);
    const benchmarkReturnPct = returnPct(Number(firstCandle.close), Number(latestCandle.close));
    const beta = calculateBeta(portfolioReturnValues, benchmarkReturnValues);
    const correlationPct = correlation(portfolioReturnValues, benchmarkReturnValues) * 100;
    const benchmarkVolatilityPct = annualizedVolatility(benchmarkReturnValues) * 100;
    const benchmarkDrawdown = buildBenchmarkDrawdown(validCandles);
    const benchmarkMaxDrawdownPct = Math.min(0, ...benchmarkDrawdown.map((point) => point.drawdownPct));
    const alphaPct = portfolioReturnPct - benchmarkReturnPct;
    const capmAlphaPct = calculateCapmAlpha(portfolioReturnPct / 100, benchmarkReturnPct / 100, beta) * 100;
    const portfolioVolatilityPct = annualizedVolatility(portfolioReturnValues) * 100;
    const portfolioMaxDrawdownPct = Math.min(0, ...portfolioDrawdown.map((point) => point.drawdownPct));

    return {
      comparison: {
        benchmark,
        status: aligned.length >= 2 ? 'ready' : 'insufficient_data',
        message:
          aligned.length >= 2
            ? `${benchmark} benchmark is calculated from Moomoo historical daily candles.`
            : `Benchmark candles found, but at least 2 aligned return points are needed for beta and correlation.`,
        portfolioReturnPct,
        benchmarkReturnPct,
        alphaPct,
        beta,
        correlationPct,
        relativeVolatilityPct: portfolioVolatilityPct - benchmarkVolatilityPct,
        relativeDrawdownPct: portfolioMaxDrawdownPct - benchmarkMaxDrawdownPct,
        outperformancePct: alphaPct,
        outperformed: alphaPct >= 0
      },
      benchmarkReturns,
      beta,
      capmAlphaPct,
      correlationPct,
      benchmarkVolatilityPct,
      benchmarkMaxDrawdownPct
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch benchmark history from Moomoo.';

    return {
      ...empty,
      comparison: {
        ...empty.comparison,
        message: `Moomoo benchmark data unavailable: ${message}`
      }
    };
  }
}

function buildAllocation(snapshot: SnapshotRow | null, holdings: SnapshotHolding[]) {
  const bySymbol = allocationFromJson(snapshot?.allocationJson, snapshot?.totalValue ?? 0, holdings);
  const byAssetType = groupAllocation(holdings, (holding) => holding.assetType || 'Unknown');
  const byCurrency = groupAllocation(holdings, (holding) => holding.currency || 'Unknown');
  const targetPct = bySymbol.length > 0 ? 100 / bySymbol.length : 0;

  return {
    bySymbol,
    byAssetType,
    byCurrency,
    drift: bySymbol.map((slice) => ({
      label: slice.label,
      currentPct: slice.percentage,
      targetPct,
      driftPct: slice.percentage - targetPct,
      value: slice.value
    }))
  };
}

function buildExposure(holdings: SnapshotHolding[]): ExposureAnalysis {
  return {
    bySector: groupAllocation(holdings, (holding) => holding.sector || 'Unknown sector'),
    byCountry: groupAllocation(holdings, (holding) => holding.country || 'Unknown country'),
    byCurrency: groupAllocation(holdings, (holding) => holding.currency || 'Unknown currency'),
    byBroker: groupAllocation(holdings, (holding) => holding.brokerName || holding.accountName || 'Manual'),
    positionConcentration: groupAllocation(holdings, (holding) => holding.symbol || 'Unknown').slice(0, 10)
  };
}

function buildCorrelation(
  holdings: SnapshotHolding[],
  benchmarkAnalysis: BenchmarkAnalysis
): CorrelationAnalysis {
  const concentrationPenalty = holdings.reduce((sum, holding) => {
    const total = holdings.reduce((innerSum, row) => innerSum + Math.max(row.marketValue, 0), 0);
    const weight = total > 0 ? Math.max(holding.marketValue, 0) / total : 0;
    return sum + weight ** 2;
  }, 0);
  const diversificationScore = Math.max(0, Math.min(100, 100 - concentrationPenalty * 100));

  return {
    status: Math.abs(benchmarkAnalysis.correlationPct) > 0 ? 'ready' : 'insufficient_data',
    message:
      Math.abs(benchmarkAnalysis.correlationPct) > 0
        ? 'Correlation calculated from aligned portfolio and benchmark daily returns.'
        : 'Need aligned portfolio and benchmark return history for correlation.',
    portfolioBenchmarkCorrelationPct: benchmarkAnalysis.correlationPct,
    diversificationScore,
    matrix: holdings.slice(0, 10).map((holding) => ({
      asset: holding.symbol,
      portfolioWeightPct: percentage(
        Math.max(holding.marketValue, 0),
        holdings.reduce((sum, row) => sum + Math.max(row.marketValue, 0), 0)
      ),
      correlationToPortfolioPct: Math.max(0, Math.min(100, 100 - percentage(Math.max(holding.marketValue, 0), holdings.reduce((sum, row) => sum + Math.max(row.marketValue, 0), 0)) / 2))
    }))
  };
}

function buildPortfolioHealth(
  risk: RiskMetrics,
  exposure: ExposureAnalysis,
  correlationAnalysis: CorrelationAnalysis,
  snapshotCount: number
): PortfolioHealth {
  let score = 100;
  score -= Math.min(Math.max(risk.concentrationRiskPct - 20, 0), 35);
  score -= Math.min(Math.abs(Math.min(risk.maxDrawdownPct, 0)), 25);
  score -= Math.min(Math.max(risk.volatilityPct - 18, 0), 20);
  score -= Math.min(Math.max(risk.valueAtRisk95Pct * -1 - 2, 0) * 2, 12);
  if (risk.beta > 1.2) score -= 8;
  if (snapshotCount < 3) score -= 12;

  score = Math.round(Math.max(0, Math.min(100, score)));
  const riskLevel = score >= 75 ? 'low' : score >= 50 ? 'moderate' : 'high';
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const largestSector = exposure.bySector[0];

  if (risk.concentrationRiskPct < 25) strengths.push('Single-position concentration is controlled.');
  else weaknesses.push(`${risk.largestHoldingSymbol || 'Largest holding'} concentration is ${round(risk.concentrationRiskPct)}%.`);
  if (risk.sharpeRatio > 1) strengths.push('Risk-adjusted return is positive on the selected period.');
  if (risk.maxDrawdownPct < -15) weaknesses.push(`Max drawdown is ${round(risk.maxDrawdownPct)}%.`);
  if (largestSector && largestSector.percentage > 45) weaknesses.push(`${largestSector.label} sector exposure is ${round(largestSector.percentage)}%.`);
  if (correlationAnalysis.diversificationScore >= 70) strengths.push('Diversification score is healthy.');
  if (snapshotCount < 3) weaknesses.push('More snapshot history is needed for reliable institutional metrics.');

  return {
    score,
    riskLevel,
    label: riskLevel === 'low' ? 'Low Risk' : riskLevel === 'moderate' ? 'Moderate Risk' : 'High Volatility',
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 4)
  };
}

function buildIncome(transactions: TransactionRow[]) {
  const rows = new Map<string, IncomePoint>();

  for (const transaction of transactions) {
    const month = `${transaction.tradeDate.getUTCFullYear()}-${String(transaction.tradeDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const existing = rows.get(month) ?? { month, dividend: 0, interest: 0, total: 0 };
    const amount = Math.max(transaction.quantity * transaction.price - transaction.fee, 0);
    if (transaction.type === 'interest') existing.interest += amount;
    else existing.dividend += amount;
    existing.total += amount;
    rows.set(month, existing);
  }

  const byMonth = [...rows.values()].sort((a, b) => a.month.localeCompare(b.month));
  return {
    total: byMonth.reduce((sum, row) => sum + row.total, 0),
    byMonth
  };
}

function buildTopContributors(holdings: SnapshotHolding[]) {
  const rows: TopContributor[] = holdings.map((holding) => ({
    symbol: holding.symbol,
    name: holding.name || holding.symbol,
    assetType: holding.assetType || 'stock',
    marketValue: holding.marketValue,
    unrealizedPnl: holding.unrealizedPnl,
    unrealizedPnlPct: percentage(holding.unrealizedPnl, Math.abs(holding.quantity * holding.averageCost))
  }));

  return {
    gainers: [...rows].sort((a, b) => b.unrealizedPnl - a.unrealizedPnl).slice(0, 5),
    losers: [...rows].sort((a, b) => a.unrealizedPnl - b.unrealizedPnl).slice(0, 5)
  };
}

function buildValueSeries(snapshots: SnapshotRow[], transactions: TransactionRow[]): AnalyticsPoint[] {
  const firstValue = snapshots[0]?.totalValue ?? 0;
  return snapshots.map((snapshot) => ({
    date: isoDate(snapshot.snapshotDate),
    value: snapshot.totalValue,
    returnPct: flowAdjustedReturnPct(
      firstValue,
      snapshot.totalValue,
      externalFlows(transactions, snapshots[0]?.snapshotDate ?? null, snapshot.snapshotDate)
    )
  }));
}

function buildDrawdownSeries(snapshots: SnapshotRow[]): DrawdownPoint[] {
  let peak = 0;
  return snapshots.map((snapshot) => {
    peak = Math.max(peak, snapshot.totalValue);
    return {
      date: isoDate(snapshot.snapshotDate),
      drawdownPct: peak > 0 ? ((snapshot.totalValue - peak) / peak) * 100 : 0
    };
  });
}

function buildDailyReturns(snapshots: SnapshotRow[], transactions: TransactionRow[]): ReturnPoint[] {
  const returns: ReturnPoint[] = [];
  for (let index = 1; index < snapshots.length; index += 1) {
    const previous = snapshots[index - 1].totalValue;
    const current = snapshots[index].totalValue;
    const flows = externalFlows(transactions, snapshots[index - 1].snapshotDate, snapshots[index].snapshotDate);
    if (previous > 0 || flows.inflow > 0) {
      returns.push({
        date: isoDate(snapshots[index].snapshotDate),
        returnPct: flowAdjustedReturnPct(previous, current, flows)
      });
    }
  }
  return returns;
}

function aggregateReturns(points: ReturnPoint[], group: 'week' | 'month'): ReturnPoint[] {
  const rows = new Map<string, number[]>();
  for (const point of points) {
    const date = new Date(`${point.date}T00:00:00Z`);
    const key =
      group === 'month'
        ? point.date.slice(0, 7)
        : `${date.getUTCFullYear()}-W${String(Math.ceil((dayOfYear(date) + date.getUTCDay()) / 7)).padStart(2, '0')}`;
    rows.set(key, [...(rows.get(key) ?? []), point.returnPct / 100]);
  }

  return [...rows.entries()].map(([date, values]) => ({
    date,
    returnPct: compoundReturn(values) * 100
  }));
}

function allocationFromJson(json: string | undefined, totalValue: number, holdings: SnapshotHolding[]): AllocationSlice[] {
  const values = new Map<string, number>();

  try {
    const allocation = JSON.parse(json ?? '{}') as Record<string, number>;
    for (const [label, percentageValue] of Object.entries(allocation)) {
      const value = totalValue > 0 ? (Number(percentageValue) / 100) * totalValue : 0;
      values.set(label, value);
    }
  } catch {
    for (const holding of holdings) {
      values.set(holding.symbol, (values.get(holding.symbol) ?? 0) + holding.marketValue);
    }
  }

  return slicesFromValues(values);
}

function groupAllocation(holdings: SnapshotHolding[], key: (holding: SnapshotHolding) => string) {
  const values = new Map<string, number>();
  for (const holding of holdings) {
    values.set(key(holding), (values.get(key(holding)) ?? 0) + Math.max(holding.marketValue, 0));
  }
  return slicesFromValues(values);
}

function slicesFromValues(values: Map<string, number>): AllocationSlice[] {
  const total = [...values.values()].reduce((sum, value) => sum + Math.max(value, 0), 0);
  return [...values.entries()]
    .map(([label, value]) => ({
      label,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0
    }))
    .sort((a, b) => b.value - a.value);
}

async function enrichHoldings(holdings: SnapshotHolding[]) {
  const symbols = [...new Set(holdings.map((holding) => holding.symbol).filter(Boolean))];
  if (symbols.length === 0) return holdings;
  const assets = await prisma.asset.findMany({
    where: { symbol: { in: symbols } },
    select: { symbol: true, sector: true, country: true, assetType: true, currency: true }
  });
  const assetMap = new Map(assets.map((asset) => [asset.symbol, asset]));
  return holdings.map((holding) => {
    const asset = assetMap.get(holding.symbol);
    return {
      ...holding,
      sector: holding.sector ?? asset?.sector ?? 'Unknown sector',
      country: holding.country ?? asset?.country ?? 'Unknown country',
      assetType: holding.assetType || asset?.assetType || 'stock',
      currency: holding.currency || asset?.currency || 'USD'
    };
  });
}

function parseHoldings(json: string | undefined): SnapshotHolding[] {
  try {
    const rows = JSON.parse(json ?? '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function returnFromBoundary(
  snapshots: SnapshotRow[],
  latest: SnapshotRow | null,
  boundary: Date | null,
  transactions: TransactionRow[]
) {
  if (!latest || !boundary) return 0;
  const first = snapshots.find((snapshot) => snapshot.snapshotDate >= boundary) ?? snapshots[0];
  return flowAdjustedReturnPct(
    first?.totalValue ?? 0,
    latest.totalValue,
    externalFlows(transactions, first?.snapshotDate ?? null, latest.snapshotDate)
  );
}

function startOfMonth(date: Date | undefined) {
  if (!date) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfYear(date: Date | undefined) {
  if (!date) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

function returnPct(startValue: number, endValue: number) {
  if (startValue <= 0) return 0;
  return ((endValue - startValue) / startValue) * 100;
}

function flowAdjustedReturnPct(startValue: number, endValue: number, flows: ExternalFlows) {
  const compatibleFlows = compatibleExternalFlows(startValue, endValue, flows);
  if (!compatibleFlows.compatible) {
    return returnPct(startValue, endValue);
  }

  const denominator = startValue + compatibleFlows.flows.inflow;
  if (denominator <= 0) return 0;
  return ((endValue - startValue - compatibleFlows.flows.net) / denominator) * 100;
}

function externalFlows(transactions: TransactionRow[], startExclusive: Date | null, endInclusive: Date | null): ExternalFlows {
  const rows = transactions.filter((transaction) => {
    if (!endInclusive || transaction.tradeDate > endInclusive) return false;
    if (startExclusive && transaction.tradeDate <= startExclusive) return false;
    return ['deposit', 'withdrawal'].includes(transaction.type);
  });
  const inflow = rows
    .filter((transaction) => transaction.type === 'deposit')
    .reduce((sum, transaction) => sum + Math.max(transaction.price - transaction.fee, 0), 0);
  const outflow = rows
    .filter((transaction) => transaction.type === 'withdrawal')
    .reduce((sum, transaction) => sum + Math.max(transaction.price + transaction.fee, 0), 0);

  return { inflow, outflow, net: inflow - outflow };
}

function netExternalContribution(transactions: TransactionRow[], endInclusive: Date, portfolioValue: number) {
  const flows = externalFlows(transactions, null, endInclusive);
  return compatibleExternalFlows(0, portfolioValue, flows).flows.net;
}

function compatibleExternalFlows(startValue: number, endValue: number, flows: ExternalFlows) {
  const grossFlow = Math.abs(flows.inflow) + Math.abs(flows.outflow);
  if (grossFlow <= 0) return { compatible: true, flows };

  const referenceValue = Math.max(Math.abs(startValue), Math.abs(endValue), 1);
  const flowDominatesSnapshot = grossFlow > referenceValue * 10;
  const largeDepositMissingFromSnapshot = flows.inflow > referenceValue * 5 && endValue < flows.inflow * 0.5;

  if (flowDominatesSnapshot || largeDepositMissingFromSnapshot) {
    return {
      compatible: false,
      flows: { inflow: 0, outflow: 0, net: 0 }
    };
  }

  return { compatible: true, flows };
}

function percentage(value: number, total: number) {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

function cagr(startDate: Date | undefined, endDate: Date | undefined, startValue: number, endValue: number) {
  const days = startDate && endDate ? daysBetween(startDate, endDate) : 0;
  if (days < 30 || startValue <= 0 || endValue <= 0) return 0;
  return (Math.pow(endValue / startValue, 365 / days) - 1) * 100;
}

function daysBetween(startDate: Date, endDate: Date) {
  return Math.max(0, (endDate.getTime() - startDate.getTime()) / 86_400_000);
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function covariance(a: number[], b: number[]) {
  if (a.length < 2 || a.length !== b.length) return 0;
  const meanA = average(a);
  const meanB = average(b);
  return a.reduce((sum, value, index) => sum + (value - meanA) * (b[index] - meanB), 0) / (a.length - 1);
}

function variance(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
}

function calculateBeta(portfolioReturns: number[], benchmarkReturns: number[]) {
  const benchmarkVariance = variance(benchmarkReturns);
  return benchmarkVariance > 0 ? covariance(portfolioReturns, benchmarkReturns) / benchmarkVariance : 0;
}

function calculateCapmAlpha(portfolioReturn: number, benchmarkReturn: number, beta: number) {
  return portfolioReturn - (RISK_FREE_RATE + beta * (benchmarkReturn - RISK_FREE_RATE));
}

function correlation(a: number[], b: number[]) {
  const denominator = standardDeviation(a) * standardDeviation(b);
  return denominator > 0 ? covariance(a, b) / denominator : 0;
}

function annualizedVolatility(values: number[]) {
  return values.length >= 2 ? standardDeviation(values) * Math.sqrt(TRADING_DAYS) : 0;
}

function valueAtRisk95(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.05)] ?? 0;
}

function compoundReturn(values: number[]) {
  return values.reduce((product, value) => product * (1 + value), 1) - 1;
}

function buildCandleReturns(candles: HistoricalCandle[]): ReturnPoint[] {
  const returns: ReturnPoint[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const previous = Number(candles[index - 1].close);
    const current = Number(candles[index].close);
    if (previous > 0) {
      returns.push({
        date: String(candles[index].time_key).slice(0, 10),
        returnPct: returnPct(previous, current)
      });
    }
  }
  return returns;
}

function buildBenchmarkDrawdown(candles: HistoricalCandle[]): DrawdownPoint[] {
  let peak = 0;
  return candles.map((candle) => {
    const value = Number(candle.close);
    peak = Math.max(peak, value);
    return {
      date: String(candle.time_key).slice(0, 10),
      drawdownPct: peak > 0 ? ((value - peak) / peak) * 100 : 0
    };
  });
}

function alignReturns(portfolioReturns: ReturnPoint[], benchmarkReturns: ReturnPoint[]) {
  const benchmarkMap = new Map(benchmarkReturns.map((point) => [point.date, point.returnPct]));
  return portfolioReturns
    .map((point) => ({
      date: point.date,
      portfolio: point.returnPct,
      benchmark: benchmarkMap.get(point.date)
    }))
    .filter((row): row is { date: string; portfolio: number; benchmark: number } => typeof row.benchmark === 'number');
}

function emptyBenchmarkAnalysis(benchmark: AnalyticsBenchmark, portfolioReturnPct: number): BenchmarkAnalysis {
  return {
    comparison: {
      benchmark,
      status: 'insufficient_data',
      message: 'Benchmark data is unavailable.',
      portfolioReturnPct,
      benchmarkReturnPct: 0,
      alphaPct: 0,
      beta: 0,
      correlationPct: 0,
      relativeVolatilityPct: 0,
      relativeDrawdownPct: 0,
      outperformancePct: 0,
      outperformed: false
    },
    benchmarkReturns: [],
    beta: 0,
    capmAlphaPct: 0,
    correlationPct: 0,
    benchmarkVolatilityPct: 0,
    benchmarkMaxDrawdownPct: 0
  };
}

async function readAnalyticsCache(cacheKey: string): Promise<AnalyticsDashboard | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ payloadJson: string; expiresAt: Date }>>`
      SELECT payload_json AS payloadJson, expires_at AS expiresAt
      FROM analytics_cache
      WHERE cache_key = ${cacheKey}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row || row.expiresAt <= new Date()) return null;
    return JSON.parse(row.payloadJson) as AnalyticsDashboard;
  } catch {
    return null;
  }
}

async function writeAnalyticsArtifacts(userId: string, cacheKey: string, dashboard: AnalyticsDashboard) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60_000);
  const payloadJson = JSON.stringify(dashboard);

  try {
    await prisma.$executeRaw`
      INSERT INTO analytics_cache (id, user_id, cache_key, cache_type, payload_json, generated_at, expires_at, created_at, updated_at)
      VALUES (${randomUUID()}, ${userId}, ${cacheKey}, 'phase3a_dashboard', ${payloadJson}, ${now}, ${expiresAt}, ${now}, ${now})
      ON DUPLICATE KEY UPDATE
        payload_json = VALUES(payload_json),
        generated_at = VALUES(generated_at),
        expires_at = VALUES(expires_at),
        updated_at = VALUES(updated_at)
    `;

    for (const point of dashboard.dailyReturns) {
      await prisma.$executeRaw`
        INSERT INTO portfolio_daily_returns (id, user_id, snapshot_date, portfolio_value, daily_return, cumulative_return, benchmark_return, created_at, updated_at)
        VALUES (
          ${randomUUID()},
          ${userId},
          ${new Date(`${point.date}T00:00:00Z`)},
          ${dashboard.valueSeries.find((row) => row.date === point.date)?.value ?? 0},
          ${point.returnPct},
          ${dashboard.valueSeries.find((row) => row.date === point.date)?.returnPct ?? 0},
          ${0},
          ${now},
          ${now}
        )
        ON DUPLICATE KEY UPDATE
          portfolio_value = VALUES(portfolio_value),
          daily_return = VALUES(daily_return),
          cumulative_return = VALUES(cumulative_return),
          updated_at = VALUES(updated_at)
      `;
    }
  } catch {
    // Cache tables are an optimization. The dashboard should remain usable if migrations are pending.
  }
}

function dayOfYear(date: Date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

function round(value: number, decimals = 2) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
