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
import { getHoldings } from '$lib/services/portfolio.service';
import { rebalanceSuggestionsToTickets } from '$lib/services/execution-bridge.service';
import { approveTradeTicket, getTradeTicket } from '$lib/services/trade-layer.service';
import { previewMoomooExecution, submitMoomooExecution, type ExecutionSafetyCheck } from '$lib/services/moomoo-execution.service';
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
  },

  queueRebalance: async ({ request }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    const portfolioMode = parseSimulationPortfolioMode(form.get('portfolioMode'));
    try {
      const [suggestions, holdings] = await Promise.all([
        getRebalanceSuggestionsByMode(user.id, portfolioMode),
        getHoldings(user.id)
      ]);
      const totalValue = holdings
        .filter((h) => h.quantity > 0)
        .reduce((sum, h) => sum + h.marketValue, 0);
      const { tickets, skipped } = await rebalanceSuggestionsToTickets(user.id, suggestions, totalValue);
      return {
        status: 'queued',
        ticketIds: tickets.map((t) => t.id).join(','),
        tickets,
        skipped
      };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Failed to queue rebalance.' });
    }
  },

  executeAll: async ({ request }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    const ticketIds = String(form.get('ticketIds') ?? '').split(',').filter(Boolean);
    const results: Array<{ ticketId: string; status: string; message: string; brokerOrderId?: string | null }> = [];

    for (const ticketId of ticketIds) {
      try {
        const ticket = await getTradeTicket(user.id, ticketId);
        if (!ticket) {
          results.push({ ticketId, status: 'failed', message: 'Ticket not found.' });
          continue;
        }

        // Assert paper mode — fail fast if violated
        const meta = ticket.metadata as Record<string, unknown>;
        if (meta?.mode !== 'paper') {
          results.push({ ticketId, status: 'failed', message: 'Only paper mode tickets allowed here.' });
          continue;
        }

        await approveTradeTicket(user.id, ticketId, 'Approved via rebalance execute-all');
        const preview = await previewMoomooExecution(user.id, { tradeTicketId: ticketId, mode: 'paper' });

        if (preview.status === 'blocked') {
          const blocked = (preview.safetyChecks as ExecutionSafetyCheck[] | undefined)
            ?.find((c) => c.checkStatus === 'block');
          results.push({ ticketId, status: 'blocked', message: blocked?.message ?? 'Safety check blocked.' });
          continue;
        }

        const submitted = await submitMoomooExecution(user.id, preview.id, { confirm: true });
        const sub = (submitted.submissions as Array<{ brokerOrderId?: string }> | undefined)?.[0];
        results.push({
          ticketId,
          status: submitted.status,
          message: `${ticket.symbol} submitted to paper.`,
          brokerOrderId: sub?.brokerOrderId ?? null
        });
      } catch (err) {
        results.push({ ticketId, status: 'failed', message: err instanceof Error ? err.message : 'Execution failed.' });
      }
    }

    return { status: 'execution_done', results };
  }
};
