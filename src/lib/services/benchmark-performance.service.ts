import { prisma } from '$lib/server/db';
import { getHistoricalCandles, type HistoricalCandle } from '$lib/services/broker.service';
import {
  BENCHMARKS,
  getAnalyticsDashboard,
  type AnalyticsBenchmark,
  type AnalyticsPeriod,
  type BenchmarkComparison
} from '$lib/services/analytics.service';

const PRIMARY_BENCHMARKS: AnalyticsBenchmark[] = ['SPY', 'QQQ', 'VOO'];
const BENCHMARK_CODES: Record<AnalyticsBenchmark, string> = {
  SPY: 'US.SPY',
  QQQ: 'US.QQQ',
  VOO: 'US.VOO',
  DIA: 'US.DIA',
  SCHG: 'US.SCHG',
  SCHD: 'US.SCHD',
  VT: 'US.VT'
};

type SeriesPoint = {
  date: string;
  portfolioReturnPct: number;
  benchmarkReturnPct: number;
  spreadPct: number;
};

export type RollingReturnPoint = SeriesPoint & {
  window: '1W' | '1M' | '3M';
};

export type DrawdownComparisonPoint = {
  date: string;
  portfolioDrawdownPct: number;
  benchmarkDrawdownPct: number;
  relativeDrawdownPct: number;
};

export type RiskAdjustedPerformance = {
  status: 'ready' | 'insufficient_data';
  sharpeRatio: number;
  sortinoRatio: number;
  trackingErrorPct: number;
  informationRatio: number;
  portfolioVolatilityPct: number;
  benchmarkVolatilityPct: number;
  annualizedPortfolioReturnPct: number;
  annualizedBenchmarkReturnPct: number;
  annualizedExcessReturnPct: number;
};

export type AlphaBetaPerformance = {
  status: 'ready' | 'insufficient_data';
  alphaPct: number;
  capmAlphaPct: number;
  beta: number;
  correlationPct: number;
  rSquaredPct: number;
  sensitivity: 'High Beta' | 'Market Beta' | 'Defensive Beta' | 'Insufficient Data';
};

export type PerformanceAttributionRow = {
  label: string;
  contributionPct: number;
  weightPct: number;
};

export type PerformanceAttribution = {
  status: 'ready' | 'insufficient_data';
  sectorContribution: PerformanceAttributionRow[];
  assetContribution: PerformanceAttributionRow[];
  riskContribution: PerformanceAttributionRow[];
  cashDragPct: number;
  currencyImpactPct: number;
};

export type RelativePerformanceCategory =
  | 'Outperforming'
  | 'Neutral'
  | 'Underperforming'
  | 'High Beta'
  | 'Low Volatility'
  | 'Market Leader'
  | 'Defensive Performer';

export type BenchmarkPerformanceDashboard = {
  status: 'ready' | 'insufficient_data';
  message: string;
  period: AnalyticsPeriod;
  benchmark: AnalyticsBenchmark;
  benchmarkCode: string;
  snapshotDate: string | null;
  dataSource: 'moomoo' | 'stored' | 'unavailable';
  selected: BenchmarkComparison;
  comparisons: BenchmarkComparison[];
  relativeSeries: SeriesPoint[];
  rollingReturns: RollingReturnPoint[];
  drawdownComparison: DrawdownComparisonPoint[];
  alphaBeta: AlphaBetaPerformance;
  riskAdjusted: RiskAdjustedPerformance;
  attribution: PerformanceAttribution;
  categories: RelativePerformanceCategory[];
  scorecard: {
    outperformanceDays: number;
    underperformanceDays: number;
    hitRatePct: number;
    bestRelativeDay: SeriesPoint | null;
    worstRelativeDay: SeriesPoint | null;
    latestSpreadPct: number;
  };
};

export async function getBenchmarkPerformanceDashboard(
  userId: string,
  brokerAccId: string | null = null,
  period: AnalyticsPeriod = 'MAX',
  benchmark: AnalyticsBenchmark = 'SPY'
): Promise<BenchmarkPerformanceDashboard> {
  const benchmarkList = uniqueBenchmarks([benchmark, ...PRIMARY_BENCHMARKS]);
  const analyticsList = await Promise.all(
    benchmarkList.map((symbol) => getAnalyticsDashboard(userId, brokerAccId, period, symbol))
  );
  const selectedAnalytics = analyticsList.find((item) => item.benchmark.benchmark === benchmark) ?? analyticsList[0];
  const selected = selectedAnalytics.benchmark;
  const start = selectedAnalytics.summary.firstSnapshotDate;
  const end = selectedAnalytics.summary.latestSnapshotDate;
  const benchmarkHistory = await loadBenchmarkHistory(benchmark, start, end);

  const relativeSeries = buildRelativeSeries(selectedAnalytics.dailyReturns, benchmarkHistory.candles);
  const rollingReturns = buildRollingReturns(selectedAnalytics.valueSeries, benchmarkHistory.candles);
  const alignedReturns = alignReturns(selectedAnalytics.dailyReturns, buildCandleReturns(benchmarkHistory.candles));
  const drawdownComparison = buildDrawdownComparison(selectedAnalytics.drawdownSeries, benchmarkHistory.candles);
  const alphaBeta = buildAlphaBeta(selected, selectedAnalytics.risk);
  const riskAdjusted = buildRiskAdjustedPerformance(alignedReturns, selectedAnalytics.risk);
  const attribution = buildPerformanceAttribution(selectedAnalytics);
  const categories = buildCategories(selected, riskAdjusted, alphaBeta);
  const status = selected.status === 'ready' && relativeSeries.length > 0 ? 'ready' : 'insufficient_data';
  const dashboard: BenchmarkPerformanceDashboard = {
    status,
    message:
      status === 'ready'
        ? `Benchmark engine is using real ${benchmarkHistory.source} data for ${BENCHMARK_CODES[benchmark]}.`
        : selected.message || benchmarkHistory.message,
    period,
    benchmark,
    benchmarkCode: BENCHMARK_CODES[benchmark],
    snapshotDate: selectedAnalytics.summary.latestSnapshotDate,
    dataSource: benchmarkHistory.source,
    selected,
    comparisons: analyticsList.map((item) => item.benchmark),
    relativeSeries,
    rollingReturns,
    drawdownComparison,
    alphaBeta,
    riskAdjusted,
    attribution,
    categories,
    scorecard: buildScorecard(relativeSeries)
  };

  await writeBenchmarkArtifacts(userId, dashboard);
  return dashboard;
}

function uniqueBenchmarks(values: AnalyticsBenchmark[]) {
  return values.filter((value, index, array) => BENCHMARKS.includes(value) && array.indexOf(value) === index);
}

async function loadBenchmarkHistory(benchmark: AnalyticsBenchmark, start: string | null, end: string | null) {
  if (!start || !end || start === end) {
    return {
      source: 'unavailable' as const,
      message: 'Need at least 2 dated portfolio snapshots before benchmark history can be aligned.',
      candles: [] as HistoricalCandle[]
    };
  }

  const code = BENCHMARK_CODES[benchmark];

  try {
    const candles = (await getHistoricalCandles(code, start, end)).filter((candle) => Number(candle.close) > 0);
    if (candles.length >= 2) {
      return { source: 'moomoo' as const, message: 'Loaded benchmark candles from Moomoo OpenD.', candles };
    }
  } catch {
    // Fall through to stored benchmark prices. The UI will disclose the actual source.
  }

  const stored = await prisma.benchmarkPrice.findMany({
    where: {
      symbol: { in: [benchmark, code] },
      date: {
        gte: new Date(start),
        lte: new Date(end)
      }
    },
    orderBy: { date: 'asc' }
  });

  const candles = stored.map((row) => ({
    code,
    time_key: isoDate(row.date),
    open: row.open,
    close: row.adjClose || row.close,
    high: row.high,
    low: row.low,
    volume: row.volume
  }));

  return {
    source: candles.length >= 2 ? ('stored' as const) : ('unavailable' as const),
    message:
      candles.length >= 2
        ? 'Loaded benchmark candles from stored benchmark_prices.'
        : `No benchmark candles available for ${code}. Sync/import benchmark history first.`,
    candles
  };
}

function buildRelativeSeries(portfolioReturns: Array<{ date: string; returnPct: number }>, candles: HistoricalCandle[]) {
  const benchmarkReturns = buildCandleReturns(candles);
  const benchmarkByDate = new Map(benchmarkReturns.map((point) => [point.date, point.returnPct]));
  let portfolioCumulative = 1;
  let benchmarkCumulative = 1;
  const rows: SeriesPoint[] = [];

  for (const point of portfolioReturns) {
    const benchmarkReturn = benchmarkByDate.get(point.date);
    if (typeof benchmarkReturn !== 'number') continue;

    portfolioCumulative *= 1 + point.returnPct / 100;
    benchmarkCumulative *= 1 + benchmarkReturn / 100;
    const portfolioReturnPct = (portfolioCumulative - 1) * 100;
    const benchmarkReturnPct = (benchmarkCumulative - 1) * 100;

    rows.push({
      date: point.date,
      portfolioReturnPct,
      benchmarkReturnPct,
      spreadPct: portfolioReturnPct - benchmarkReturnPct
    });
  }

  return rows;
}

function buildRollingReturns(
  portfolioSeries: Array<{ date: string; value: number }>,
  candles: HistoricalCandle[]
): RollingReturnPoint[] {
  const benchmarkByDate = new Map(candles.map((candle) => [isoDate(candle.time_key), Number(candle.close)]));
  const aligned = portfolioSeries
    .map((point) => ({
      date: point.date,
      portfolioValue: point.value,
      benchmarkValue: benchmarkByDate.get(point.date)
    }))
    .filter((point): point is { date: string; portfolioValue: number; benchmarkValue: number } => {
      return Number(point.portfolioValue) > 0 && Number(point.benchmarkValue) > 0;
    });

  return [
    ...rollingWindow(aligned, 5, '1W'),
    ...rollingWindow(aligned, 21, '1M'),
    ...rollingWindow(aligned, 63, '3M')
  ];
}

function rollingWindow(
  aligned: Array<{ date: string; portfolioValue: number; benchmarkValue: number }>,
  windowSize: number,
  label: RollingReturnPoint['window']
) {
  const rows: RollingReturnPoint[] = [];
  for (let index = windowSize; index < aligned.length; index += 1) {
    const current = aligned[index];
    const previous = aligned[index - windowSize];
    const portfolioReturnPct = returnPct(previous.portfolioValue, current.portfolioValue);
    const benchmarkReturnPct = returnPct(previous.benchmarkValue, current.benchmarkValue);
    rows.push({
      date: current.date,
      window: label,
      portfolioReturnPct,
      benchmarkReturnPct,
      spreadPct: portfolioReturnPct - benchmarkReturnPct
    });
  }
  return rows;
}

function buildCandleReturns(candles: HistoricalCandle[]) {
  const rows: Array<{ date: string; returnPct: number }> = [];
  for (let index = 1; index < candles.length; index += 1) {
    const previous = Number(candles[index - 1].close);
    const current = Number(candles[index].close);
    if (previous > 0 && current > 0) {
      rows.push({ date: isoDate(candles[index].time_key), returnPct: returnPct(previous, current) });
    }
  }
  return rows;
}

function alignReturns(
  portfolioReturns: Array<{ date: string; returnPct: number }>,
  benchmarkReturns: Array<{ date: string; returnPct: number }>
) {
  const benchmarkByDate = new Map(benchmarkReturns.map((point) => [point.date, point.returnPct]));
  return portfolioReturns
    .map((point) => ({
      date: point.date,
      portfolioReturnPct: point.returnPct,
      benchmarkReturnPct: benchmarkByDate.get(point.date)
    }))
    .filter((point): point is { date: string; portfolioReturnPct: number; benchmarkReturnPct: number } => {
      return typeof point.benchmarkReturnPct === 'number';
    });
}

function buildDrawdownComparison(
  portfolioDrawdown: Array<{ date: string; drawdownPct: number }>,
  candles: HistoricalCandle[]
): DrawdownComparisonPoint[] {
  const benchmarkDrawdown = buildBenchmarkDrawdown(candles);
  const benchmarkByDate = new Map(benchmarkDrawdown.map((point) => [point.date, point.drawdownPct]));

  return portfolioDrawdown
    .map((point) => ({
      date: point.date,
      portfolioDrawdownPct: point.drawdownPct,
      benchmarkDrawdownPct: benchmarkByDate.get(point.date)
    }))
    .filter((point): point is { date: string; portfolioDrawdownPct: number; benchmarkDrawdownPct: number } => {
      return typeof point.benchmarkDrawdownPct === 'number';
    })
    .map((point) => ({
      ...point,
      relativeDrawdownPct: point.portfolioDrawdownPct - point.benchmarkDrawdownPct
    }));
}

function buildBenchmarkDrawdown(candles: HistoricalCandle[]) {
  let peak = 0;
  return candles.map((candle) => {
    const value = Number(candle.close);
    peak = Math.max(peak, value);
    return {
      date: isoDate(candle.time_key),
      drawdownPct: peak > 0 ? ((value - peak) / peak) * 100 : 0
    };
  });
}

function buildAlphaBeta(selected: BenchmarkComparison, risk: { alphaPct: number }): AlphaBetaPerformance {
  const status = selected.status;
  const rSquaredPct = Math.max(0, Math.min(100, (selected.correlationPct / 100) ** 2 * 100));
  return {
    status,
    alphaPct: selected.alphaPct,
    capmAlphaPct: risk.alphaPct,
    beta: selected.beta,
    correlationPct: selected.correlationPct,
    rSquaredPct,
    sensitivity:
      status !== 'ready'
        ? 'Insufficient Data'
        : selected.beta >= 1.15
          ? 'High Beta'
          : selected.beta <= 0.85
            ? 'Defensive Beta'
            : 'Market Beta'
  };
}

function buildRiskAdjustedPerformance(
  alignedReturns: Array<{ portfolioReturnPct: number; benchmarkReturnPct: number }>,
  risk: { sharpeRatio: number; sortinoRatio: number }
): RiskAdjustedPerformance {
  const portfolioReturns = alignedReturns.map((point) => point.portfolioReturnPct / 100);
  const benchmarkReturns = alignedReturns.map((point) => point.benchmarkReturnPct / 100);
  const excessReturns = alignedReturns.map((point) => (point.portfolioReturnPct - point.benchmarkReturnPct) / 100);
  const portfolioVolatility = annualizedVolatility(portfolioReturns);
  const benchmarkVolatility = annualizedVolatility(benchmarkReturns);
  const annualizedPortfolioReturn = annualizedMeanReturn(portfolioReturns);
  const annualizedBenchmarkReturn = annualizedMeanReturn(benchmarkReturns);
  const trackingError = annualizedVolatility(excessReturns);

  return {
    status: alignedReturns.length >= 2 ? 'ready' : 'insufficient_data',
    sharpeRatio: risk.sharpeRatio,
    sortinoRatio: risk.sortinoRatio,
    trackingErrorPct: trackingError * 100,
    informationRatio: trackingError > 0 ? (annualizedPortfolioReturn - annualizedBenchmarkReturn) / trackingError : 0,
    portfolioVolatilityPct: portfolioVolatility * 100,
    benchmarkVolatilityPct: benchmarkVolatility * 100,
    annualizedPortfolioReturnPct: annualizedPortfolioReturn * 100,
    annualizedBenchmarkReturnPct: annualizedBenchmarkReturn * 100,
    annualizedExcessReturnPct: (annualizedPortfolioReturn - annualizedBenchmarkReturn) * 100
  };
}

function buildPerformanceAttribution(selectedAnalytics: Awaited<ReturnType<typeof getAnalyticsDashboard>>): PerformanceAttribution {
  const portfolioReturnPct = selectedAnalytics.summary.totalReturnPct;
  const sectorContribution = selectedAnalytics.exposure.bySector.slice(0, 8).map((slice) => ({
    label: slice.label,
    weightPct: slice.percentage,
    contributionPct: (slice.percentage / 100) * portfolioReturnPct
  }));
  const assetContribution = selectedAnalytics.allocation.bySymbol.slice(0, 10).map((slice) => ({
    label: slice.label,
    weightPct: slice.percentage,
    contributionPct: (slice.percentage / 100) * portfolioReturnPct
  }));
  const riskContribution = selectedAnalytics.exposure.positionConcentration.slice(0, 10).map((slice) => ({
    label: slice.label,
    weightPct: slice.percentage,
    contributionPct: (slice.percentage / 100) * selectedAnalytics.risk.volatilityPct
  }));

  return {
    status: sectorContribution.length > 0 || assetContribution.length > 0 ? 'ready' : 'insufficient_data',
    sectorContribution,
    assetContribution,
    riskContribution,
    cashDragPct: selectedAnalytics.summary.cashRatio > 0 ? -(selectedAnalytics.summary.cashRatio / 100) * portfolioReturnPct : 0,
    currencyImpactPct: selectedAnalytics.exposure.byCurrency.length > 1 ? selectedAnalytics.benchmark.outperformancePct * 0.1 : 0
  };
}

function buildCategories(
  selected: BenchmarkComparison,
  riskAdjusted: RiskAdjustedPerformance,
  alphaBeta: AlphaBetaPerformance
): RelativePerformanceCategory[] {
  const categories: RelativePerformanceCategory[] = [];
  if (selected.status !== 'ready') return ['Neutral'];
  if (selected.outperformancePct > 2) categories.push('Outperforming');
  if (selected.outperformancePct < -2) categories.push('Underperforming');
  if (Math.abs(selected.outperformancePct) <= 2) categories.push('Neutral');
  if (alphaBeta.beta >= 1.15) categories.push('High Beta');
  if (riskAdjusted.portfolioVolatilityPct < riskAdjusted.benchmarkVolatilityPct) categories.push('Low Volatility');
  if (selected.outperformancePct > 0 && selected.beta >= 1) categories.push('Market Leader');
  if (selected.outperformancePct >= 0 && selected.beta < 1) categories.push('Defensive Performer');
  return categories.slice(0, 4);
}

function buildScorecard(rows: SeriesPoint[]) {
  const outperformanceDays = rows.filter((row) => row.spreadPct >= 0).length;
  const underperformanceDays = rows.length - outperformanceDays;
  const sorted = [...rows].sort((a, b) => a.spreadPct - b.spreadPct);

  return {
    outperformanceDays,
    underperformanceDays,
    hitRatePct: rows.length > 0 ? (outperformanceDays / rows.length) * 100 : 0,
    bestRelativeDay: sorted.at(-1) ?? null,
    worstRelativeDay: sorted[0] ?? null,
    latestSpreadPct: rows.at(-1)?.spreadPct ?? 0
  };
}

function returnPct(start: number, end: number) {
  return start > 0 ? ((end - start) / start) * 100 : 0;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function annualizedVolatility(values: number[]) {
  return values.length >= 2 ? standardDeviation(values) * Math.sqrt(252) : 0;
}

function annualizedMeanReturn(values: number[]) {
  return values.length > 0 ? average(values) * 252 : 0;
}

async function writeBenchmarkArtifacts(userId: string, dashboard: BenchmarkPerformanceDashboard) {
  const now = new Date();
  const snapshotDate = dashboard.snapshotDate ? new Date(`${dashboard.snapshotDate}T00:00:00Z`) : new Date();
  const metadataJson = JSON.stringify({
    period: dashboard.period,
    dataSource: dashboard.dataSource,
    categories: dashboard.categories,
    version: 'phase-3c.0'
  });

  try {
    await prisma.$executeRaw`
      INSERT INTO benchmark_performance_metrics (
        id, user_id, benchmark_symbol, snapshot_date, portfolio_return, benchmark_return, relative_return,
        alpha, beta, sharpe_ratio, sortino_ratio, tracking_error, information_ratio, metadata, created_at, updated_at
      )
      VALUES (
        UUID(), ${userId}, ${dashboard.benchmark}, ${snapshotDate}, ${dashboard.selected.portfolioReturnPct},
        ${dashboard.selected.benchmarkReturnPct}, ${dashboard.selected.outperformancePct}, ${dashboard.alphaBeta.capmAlphaPct},
        ${dashboard.alphaBeta.beta}, ${dashboard.riskAdjusted.sharpeRatio}, ${dashboard.riskAdjusted.sortinoRatio},
        ${dashboard.riskAdjusted.trackingErrorPct}, ${dashboard.riskAdjusted.informationRatio}, ${metadataJson}, ${now}, ${now}
      )
      ON DUPLICATE KEY UPDATE
        portfolio_return = VALUES(portfolio_return),
        benchmark_return = VALUES(benchmark_return),
        relative_return = VALUES(relative_return),
        alpha = VALUES(alpha),
        beta = VALUES(beta),
        sharpe_ratio = VALUES(sharpe_ratio),
        sortino_ratio = VALUES(sortino_ratio),
        tracking_error = VALUES(tracking_error),
        information_ratio = VALUES(information_ratio),
        metadata = VALUES(metadata),
        updated_at = VALUES(updated_at)
    `;

    for (const point of dashboard.rollingReturns.slice(-90)) {
      await prisma.$executeRaw`
        INSERT INTO rolling_performance_metrics (
          id, user_id, benchmark_symbol, period, snapshot_date, portfolio_return, benchmark_return,
          relative_strength, volatility_difference, metadata, created_at, updated_at
        )
        VALUES (
          UUID(), ${userId}, ${dashboard.benchmark}, ${point.window}, ${new Date(`${point.date}T00:00:00Z`)},
          ${point.portfolioReturnPct}, ${point.benchmarkReturnPct}, ${point.spreadPct},
          ${dashboard.riskAdjusted.portfolioVolatilityPct - dashboard.riskAdjusted.benchmarkVolatilityPct},
          ${metadataJson}, ${now}, ${now}
        )
        ON DUPLICATE KEY UPDATE
          portfolio_return = VALUES(portfolio_return),
          benchmark_return = VALUES(benchmark_return),
          relative_strength = VALUES(relative_strength),
          volatility_difference = VALUES(volatility_difference),
          metadata = VALUES(metadata),
          updated_at = VALUES(updated_at)
      `;
    }

    await prisma.$executeRaw`
      INSERT INTO performance_attribution_reports (
        id, user_id, benchmark_symbol, snapshot_date, sector_contribution_json, asset_contribution_json,
        risk_contribution_json, metadata, created_at, updated_at
      )
      VALUES (
        UUID(), ${userId}, ${dashboard.benchmark}, ${snapshotDate},
        ${JSON.stringify(dashboard.attribution.sectorContribution)},
        ${JSON.stringify(dashboard.attribution.assetContribution)},
        ${JSON.stringify(dashboard.attribution.riskContribution)},
        ${metadataJson}, ${now}, ${now}
      )
      ON DUPLICATE KEY UPDATE
        sector_contribution_json = VALUES(sector_contribution_json),
        asset_contribution_json = VALUES(asset_contribution_json),
        risk_contribution_json = VALUES(risk_contribution_json),
        metadata = VALUES(metadata),
        updated_at = VALUES(updated_at)
    `;
  } catch {
    // Phase 3C storage is best-effort so pending migrations do not break analytics views.
  }
}

function isoDate(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}
