import { fail, type Actions } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { getAiRebalanceSuggestions } from '$lib/services/ai-rebalance.service';
import { getBehavioralProfile } from '$lib/services/behavioral-profile.service';
import { getBehavioralExplanation } from '$lib/services/ai-behavioral-explanation.service';
import {
  getOptimizationDashboard,
  getRebalanceSuggestionsByMode,
  parseOptimizationBenchmark,
  parseOptimizationPeriod,
  saveRebalanceSuggestions
} from '$lib/services/optimization-engine.service';
import {
  getRebalanceProjection,
  parseSimulationPortfolioMode,
  simulateRebalance
} from '$lib/services/scenario-simulation.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const user = await getDemoUser();
  const period = parseOptimizationPeriod(url.searchParams.get('period'));
  const benchmark = parseOptimizationBenchmark(url.searchParams.get('benchmark'));
  const portfolioMode = parseSimulationPortfolioMode(url.searchParams.get('portfolioMode'));

  const [dashboard, rebalanceProjection, modeRebalance, behavioralProfile] = await Promise.all([
    getOptimizationDashboard(user.id, { period, benchmark }),
    getRebalanceProjection(user.id, { period, benchmark, portfolioMode }),
    getRebalanceSuggestionsByMode(user.id, portfolioMode),
    getBehavioralProfile(user.id).catch(() => null),
  ]);

  // Generate AI explanation — non-blocking, fails gracefully
  const behavioralExplanation = behavioralProfile
    ? await getBehavioralExplanation(behavioralProfile).catch(() => null)
    : null;

  return {
    ...dashboard,
    rebalance: modeRebalance,
    portfolioMode,
    rebalanceProjection,
    behavioralProfile,
    behavioralExplanation,
  };
};

export const actions: Actions = {
  simulate: async ({ request, url }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    try {
      await simulateRebalance(user.id, {
        period: parseOptimizationPeriod(url.searchParams.get('period')),
        benchmark: parseOptimizationBenchmark(url.searchParams.get('benchmark')),
        portfolioMode: parseSimulationPortfolioMode(form.get('portfolioMode') ?? url.searchParams.get('portfolioMode'))
      });
      return { status: 'completed', message: 'Rebalance projection simulated.' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Rebalance simulation failed.' });
    }
  },

  aiSuggest: async ({ request }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    const portfolioMode = parseSimulationPortfolioMode(form.get('portfolioMode'));
    try {
      const { suggestions, aiUsed } = await getAiRebalanceSuggestions(user.id, portfolioMode);
      await saveRebalanceSuggestions(user.id, suggestions);
      return {
        status: 'ai_completed',
        aiUsed,
        message: aiUsed
          ? `AI generated ${suggestions.length} suggestions for ${portfolioMode} mode.`
          : `AI provider not configured — showing rule-based suggestions for ${portfolioMode} mode.`,
        suggestions
      };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'AI suggestion failed.' });
    }
  }
};
