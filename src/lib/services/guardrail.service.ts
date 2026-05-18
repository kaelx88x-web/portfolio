import { getHoldings } from '$lib/services/portfolio.service';
import {
  getOptimizationConstraints,
  type OptimizationConstraintSet,
  type PortfolioMode
} from '$lib/services/optimization-engine.service';

export type GuardrailSeverity = 'ok' | 'warning' | 'breach';

export type GuardrailViolation = {
  rule: string;
  severity: GuardrailSeverity;
  current: number;
  limit: number;
  message: string;
};

export type GuardrailReport = {
  passed: boolean;
  violations: GuardrailViolation[];
  summary: string;
};

export async function validatePortfolioGuardrails(
  userId: string,
  mode: PortfolioMode,
  constraints?: OptimizationConstraintSet
): Promise<GuardrailReport> {
  const [holdings, savedConstraints] = await Promise.all([
    getHoldings(userId),
    constraints ? Promise.resolve(constraints) : getOptimizationConstraints(userId)
  ]);

  const c = savedConstraints;
  const violations: GuardrailViolation[] = [];

  const activeHoldings = holdings.filter((h) => h.quantity > 0);
  const totalValue = activeHoldings.reduce((sum, h) => sum + h.marketValue, 0);

  if (totalValue <= 0) {
    return { passed: true, violations: [], summary: 'No holdings to validate.' };
  }

  // Stocks that are underlyings for covered calls or CSPs must not be flagged for
  // concentration — they cannot be reduced without breaking the options position.
  const optionUnderlyings = new Set(
    activeHoldings
      .filter((h) => h.assetType === 'option' || /\d{6}[CP]\d+/.test(h.symbol ?? ''))
      .map((h) => (h.symbol ?? '').replace(/^US\./, '').match(/^([A-Z]+)\d{6}[CP]/)?.[1])
      .filter((s): s is string => !!s)
  );

  // --- Single stock concentration (option contracts and their underlyings excluded) ---
  for (const h of activeHoldings.filter((h) => h.assetType !== 'option')) {
    const sym = (h.symbol ?? '').replace(/^US\./, '').match(/^([A-Z]+)/)?.[1] ?? h.symbol ?? '';
    if (optionUnderlyings.has(sym)) continue;
    const pct = (h.marketValue / totalValue) * 100;
    if (pct > c.singleStockMaxPct) {
      violations.push({
        rule: 'single_stock_max',
        severity: pct > c.singleStockMaxPct * 1.5 ? 'breach' : 'warning',
        current: +pct.toFixed(1),
        limit: c.singleStockMaxPct,
        message: `${h.symbol} is ${pct.toFixed(1)}% of portfolio (limit: ${c.singleStockMaxPct}%)`
      });
    }
  }

  // --- Sector concentration ---
  const sectorMap = new Map<string, number>();
  for (const h of activeHoldings) {
    const sector = h.sector ?? 'Unknown';
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + h.marketValue);
  }
  for (const [sector, value] of sectorMap) {
    const pct = (value / totalValue) * 100;
    if (pct > c.sectorMaxPct) {
      violations.push({
        rule: 'sector_max',
        severity: pct > c.sectorMaxPct * 1.3 ? 'breach' : 'warning',
        current: +pct.toFixed(1),
        limit: c.sectorMaxPct,
        message: `${sector} sector is ${pct.toFixed(1)}% of portfolio (limit: ${c.sectorMaxPct}%)`
      });
    }
  }

  // --- Cash minimum ---
  const cashHolding = activeHoldings.find(
    (h) => h.assetType === 'cash' || h.symbol?.toLowerCase().includes('cash')
  );
  const cashValue = cashHolding?.marketValue ?? 0;
  const cashPct = (cashValue / totalValue) * 100;
  if (cashPct < c.cashMinPct) {
    violations.push({
      rule: 'cash_min',
      severity: cashPct < c.cashMinPct * 0.5 ? 'breach' : 'warning',
      current: +cashPct.toFixed(1),
      limit: c.cashMinPct,
      message: `Cash is ${cashPct.toFixed(1)}% of portfolio (minimum: ${c.cashMinPct}%)`
    });
  }

  // --- Options allocation (hybrid / options mode) ---
  if (mode === 'options' || mode === 'hybrid') {
    const optionsHoldings = activeHoldings.filter(
      (h) => h.assetType === 'option' || /\d{6}[CP]\d+/.test(h.symbol ?? '')
    );
    const optionsValue = optionsHoldings.reduce((sum, h) => sum + h.marketValue, 0);
    const optionsPct = (optionsValue / totalValue) * 100;
    if (optionsPct > c.optionsMaxPct) {
      violations.push({
        rule: 'options_max',
        severity: 'warning',
        current: +optionsPct.toFixed(1),
        limit: c.optionsMaxPct,
        message: `Options exposure is ${optionsPct.toFixed(1)}% of portfolio (limit: ${c.optionsMaxPct}%)`
      });
    }

    // Collateral reserve — non-options capital must cover the reserve requirement.
    // collateralReservePct = minimum % of portfolio that must remain in non-options holdings.
    const nonOptionsPct = 100 - optionsPct;
    if (optionsPct > 0 && nonOptionsPct < c.collateralReservePct) {
      violations.push({
        rule: 'collateral_reserve',
        severity: nonOptionsPct < c.collateralReservePct * 0.5 ? 'breach' : 'warning',
        current: +nonOptionsPct.toFixed(1),
        limit: c.collateralReservePct,
        message: `Collateral reserve is ${nonOptionsPct.toFixed(1)}% of portfolio (minimum: ${c.collateralReservePct}%)`
      });
    }
  }

  // --- Constraint contradiction check ---
  if (c.cashMinPct + c.optionsMaxPct > 95) {
    violations.push({
      rule: 'constraint_conflict',
      severity: 'breach',
      current: c.cashMinPct + c.optionsMaxPct,
      limit: 95,
      message: `cashMinPct (${c.cashMinPct}%) + optionsMaxPct (${c.optionsMaxPct}%) exceeds 95% — leaves no room for stock holdings`
    });
  }

  const breaches = violations.filter((v) => v.severity === 'breach');
  const warnings = violations.filter((v) => v.severity === 'warning');
  const passed = breaches.length === 0;

  let summary = 'All guardrails passed.';
  if (breaches.length > 0) {
    summary = `${breaches.length} guardrail breach${breaches.length > 1 ? 'es' : ''} detected. Review before proceeding.`;
  } else if (warnings.length > 0) {
    summary = `${warnings.length} guardrail warning${warnings.length > 1 ? 's' : ''}. Optimization may adjust affected positions.`;
  }

  return { passed, violations, summary };
}
