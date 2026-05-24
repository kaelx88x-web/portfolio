import { fail, type Actions } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
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
  type RiskLevel,
} from '$lib/services/behavioral-profile.service';
import type { PageServerLoad } from './$types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseRiskLevel(value: FormDataEntryValue | string | null): RiskLevel {
  const valid: RiskLevel[] = ['conservative', 'moderate', 'aggressive'];
  return valid.includes(value as RiskLevel) ? (value as RiskLevel) : 'moderate';
}

// ─── Load ─────────────────────────────────────────────────────────────────────

export const load: PageServerLoad = async ({ url }) => {
  const user      = await getDemoUser();
  const period    = parseOptimizationPeriod(url.searchParams.get('period'));
  const benchmark = parseOptimizationBenchmark(url.searchParams.get('benchmark'));

  const [dashboard, recommendedStrategy] = await Promise.all([
    getOptimizationDashboard(user.id, { period, benchmark }),
    getRecommendedStrategy(user.id).catch(() => null),
  ]);

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
  run: async ({ request, url }) => {
    const user      = await getDemoUser();
    const form      = await request.formData();
    const riskLevel = parseRiskLevel(form.get('riskLevel'));
    try {
      // Get AI-blended strategy for this user's chosen risk level
      const strategy  = await getRecommendedStrategy(user.id, riskLevel);
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

  saveConstraints: async ({ request }) => {
    const user = await getDemoUser();
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
