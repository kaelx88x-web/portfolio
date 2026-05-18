import { fail, type Actions } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  getOptimizationDashboard,
  getUserPortfolioMode,
  parseOptimizationBenchmark,
  parseOptimizationGoal,
  parseOptimizationPeriod,
  parsePortfolioMode,
  parseRiskProfile,
  runOptimization,
  saveOptimizationConstraints,
  saveUserPortfolioMode,
  type OptimizationConstraintSet
} from '$lib/services/optimization-engine.service';
import {
  getStressTest,
  getPortfolioProjection,
  getRebalanceProjection,
  saveStressTestCache,
  savePortfolioProjectionCache
} from '$lib/services/scenario-simulation.service';
import { validatePortfolioGuardrails } from '$lib/services/guardrail.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const user = await getDemoUser();
  const period = parseOptimizationPeriod(url.searchParams.get('period'));
  const benchmark = parseOptimizationBenchmark(url.searchParams.get('benchmark'));
  const [dashboard, savedMode] = await Promise.all([
    getOptimizationDashboard(user.id, { period, benchmark }),
    getUserPortfolioMode(user.id)
  ]);
  const guardrail = await validatePortfolioGuardrails(user.id, savedMode).catch(() => null);
  const activeScenarioName = url.searchParams.get('scenario') ?? dashboard.scenarios[0]?.scenarioName ?? '';
  return {
    ...dashboard,
    savedMode,
    guardrail,
    activeScenarioName,
    activeScenario: dashboard.scenarios.find((scenario) => scenario.scenarioName === activeScenarioName) ?? dashboard.scenarios[0] ?? null
  };
};

export const actions: Actions = {
  run: async ({ request, url }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    try {
      const portfolioMode = parsePortfolioMode(form.get('portfolioMode'));
      const guardrail = await validatePortfolioGuardrails(user.id, portfolioMode);
      const period = parseOptimizationPeriod(url.searchParams.get('period'));
      const benchmark = parseOptimizationBenchmark(url.searchParams.get('benchmark'));
      await runOptimization(user.id, { portfolioMode, optimizationGoal: parseOptimizationGoal(form.get('optimizationGoal')), riskProfile: parseRiskProfile(form.get('riskProfile')), period, benchmark });

      // Pre-compute and cache heavy sub-page data so navigating to stress-test / projection / simulation is instant
      const [stressTest, projection] = await Promise.all([
        getStressTest(user.id, { period, benchmark, portfolioMode, skipCache: true }),
        getPortfolioProjection(user.id, { period, benchmark, portfolioMode, skipCache: true }),
        getRebalanceProjection(user.id, { period, benchmark, portfolioMode, persist: true })
      ]);
      await Promise.all([
        saveStressTestCache(user.id, portfolioMode, stressTest),
        savePortfolioProjectionCache(user.id, portfolioMode, projection)
      ]);

      return { status: 'completed', message: 'Optimization run completed.', guardrail };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Optimization run failed.' });
    }
  },
  saveMode: async ({ request }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    const mode = parsePortfolioMode(form.get('portfolioMode'));
    await saveUserPortfolioMode(user.id, mode);
    return { status: 'saved', mode };
  },
  saveConstraints: async ({ request }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    const constraints: Partial<OptimizationConstraintSet> = {
      singleStockMaxPct: numberField(form, 'singleStockMaxPct'),
      optionsMaxPct: numberField(form, 'optionsMaxPct'),
      hybridStockPct: numberField(form, 'hybridStockPct'),
      cashMinPct: numberField(form, 'cashMinPct'),
      sectorMaxPct: numberField(form, 'sectorMaxPct'),
      collateralReservePct: numberField(form, 'collateralReservePct'),
      targetVolatilityPct: numberField(form, 'targetVolatilityPct')
    };
    await saveOptimizationConstraints(user.id, constraints);
    return { status: 'saved', message: 'Optimization constraints saved.' };
  }
};

function numberField(form: FormData, key: keyof OptimizationConstraintSet) {
  return Number(form.get(key) ?? 0);
}
