import { fail, type Actions } from '@sveltejs/kit';
import {
  getOptimizationDashboard,
  parseOptimizationBenchmark,
  parseOptimizationPeriod,
  runOptimization,
  saveOptimizationConstraints,
  type OptimizationConstraintSet,
  type OptimizationGoal,
  type RiskProfile,
} from '$lib/services/optimization-engine.service';
import {
  getStressTest,
  getPortfolioProjection,
  getRebalanceProjection,
  saveStressTestCache,
  savePortfolioProjectionCache
} from '$lib/services/scenario-simulation.service';
import { validatePortfolioGuardrails } from '$lib/services/guardrail.service';
import {
  getRecommendedStrategy,
  validateStrategyConsistency,
  type RiskLevel,
} from '$lib/services/behavioral-profile.service';
import type { PageServerLoad } from './$types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_RISK_LEVELS: RiskLevel[] = ['conservative', 'moderate', 'aggressive'];

function isRiskLevel(value: FormDataEntryValue | null): value is RiskLevel {
  return typeof value === 'string' && VALID_RISK_LEVELS.includes(value as RiskLevel);
}

// ─── Load ─────────────────────────────────────────────────────────────────────

export const load: PageServerLoad = async ({ url, locals }) => {
  const user = locals.user!;
  const period    = parseOptimizationPeriod(url.searchParams.get('period'));
  const benchmark = parseOptimizationBenchmark(url.searchParams.get('benchmark'));

  const dashboard = await getOptimizationDashboard(user.id, { period, benchmark });
  const recommendedStrategy = locals.recommendedStrategy ?? null;

  const portfolioMode = recommendedStrategy?.portfolioMode ?? 'hybrid';
  const guardrail = await validatePortfolioGuardrails(user.id, portfolioMode).catch(() => null);

  const activeScenarioName = url.searchParams.get('scenario') ?? dashboard.scenarios[0]?.scenarioName ?? '';
  return {
    ...dashboard,
    recommendedStrategy,
    guardrail,
    activeScenarioName,
    activeScenario: dashboard.scenarios.find((s) => s.scenarioName === activeScenarioName) ?? dashboard.scenarios[0] ?? null,
  };
};

// ─── Actions ──────────────────────────────────────────────────────────────────

export const actions: Actions = {
  run: async ({ request, url, locals }) => {
    const user = locals.user!;
    const form      = await request.formData();
    const riskLevelValue = form.get('riskLevel');
    if (!isRiskLevel(riskLevelValue)) {
      return fail(400, { message: 'Invalid risk level' });
    }

    const riskLevel = riskLevelValue;
    try {
      // Get AI-blended strategy for this user's chosen risk level
      const strategy  = await getRecommendedStrategy(user.id, riskLevel);
      validateStrategyConsistency(strategy);
      const guardrail = await validatePortfolioGuardrails(user.id, strategy.portfolioMode);
      const period    = parseOptimizationPeriod(url.searchParams.get('period'));
      const benchmark = parseOptimizationBenchmark(url.searchParams.get('benchmark'));

      await runOptimization(user.id, {
        portfolioMode:    strategy.portfolioMode,
        optimizationGoal: strategy.optimizationGoal as OptimizationGoal,
        riskProfile:      strategy.riskProfile      as RiskProfile,
        period,
        benchmark,
      });

      // Pre-compute heavy sub-page data
      const [stressTest, projection] = await Promise.all([
        getStressTest(user.id, { period, benchmark, portfolioMode: strategy.portfolioMode, skipCache: true }),
        getPortfolioProjection(user.id, { period, benchmark, portfolioMode: strategy.portfolioMode, skipCache: true }),
        getRebalanceProjection(user.id, { period, benchmark, portfolioMode: strategy.portfolioMode, persist: true }),
      ]);
      await Promise.all([
        saveStressTestCache(user.id, strategy.portfolioMode, stressTest),
        savePortfolioProjectionCache(user.id, strategy.portfolioMode, projection),
      ]);

      return { status: 'completed', message: 'Optimization run completed.', guardrail };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Optimization run failed.' });
    }
  },

  saveConstraints: async ({ request, locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    const constraints: Partial<OptimizationConstraintSet> = {
      singleStockMaxPct:    numberField(form, 'singleStockMaxPct'),
      optionsMaxPct:        numberField(form, 'optionsMaxPct'),
      hybridStockPct:       numberField(form, 'hybridStockPct'),
      cashMinPct:           numberField(form, 'cashMinPct'),
      sectorMaxPct:         numberField(form, 'sectorMaxPct'),
      collateralReservePct: numberField(form, 'collateralReservePct'),
      targetVolatilityPct:  numberField(form, 'targetVolatilityPct'),
    };
    await saveOptimizationConstraints(user.id, constraints);
    return { status: 'saved', message: 'Optimization constraints saved.' };
  },
};

function numberField(form: FormData, key: keyof OptimizationConstraintSet) {
  return Number(form.get(key) ?? 0);
}
