import { fail, type Actions } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  getOptionsIntelligenceDashboard,
  parseOptionsBenchmark,
  parseOptionsPeriod,
  refreshOptionsIntelligence
} from '$lib/services/options-intelligence.service';
import {
  coveredCallToTicket,
  cspToTicket,
  cancelBridgeTicket,
  parseDte
} from '$lib/services/execution-bridge.service';
import { approveTradeTicket, getTradeTicket } from '$lib/services/trade-layer.service';
import { previewMoomooExecution, submitMoomooExecution, type ExecutionSafetyCheck } from '$lib/services/moomoo-execution.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const user = await getDemoUser();
  const period = parseOptionsPeriod(url.searchParams.get('period'));
  const benchmark = parseOptionsBenchmark(url.searchParams.get('benchmark'));
  return await getOptionsIntelligenceDashboard(user.id, { period, benchmark });
};

export const actions: Actions = {
  refresh: async ({ url }) => {
    const user = await getDemoUser();
    try {
      return {
        message: 'Options intelligence refreshed.',
        result: await refreshOptionsIntelligence(user.id, {
          period: parseOptionsPeriod(url.searchParams.get('period')),
          benchmark: parseOptionsBenchmark(url.searchParams.get('benchmark'))
        })
      };
    } catch (e) {
      return fail(400, { message: e instanceof Error ? e.message : 'Options intelligence refresh failed.' });
    }
  },

  queueOption: async ({ request }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    const optionType = String(form.get('optionType') ?? 'call') as 'call' | 'put';
    const symbol = String(form.get('symbol') ?? '');
    const dte = parseDte(form.get('dte'));
    const prevTicketId = form.get('prevTicketId') ? String(form.get('prevTicketId')) : null;

    try {
      // Cancel previous ticket if DTE changed — fail fast if cancel fails
      if (prevTicketId) {
        try {
          await cancelBridgeTicket(user.id, prevTicketId);
        } catch {
          return fail(400, {
            message: 'Could not update DTE — previous ticket still active. Cancel and retry.',
            prevTicketId
          });
        }
      }

      const dashboard = await getOptionsIntelligenceDashboard(user.id);
      let ticket;

      if (optionType === 'call') {
        const candidate = dashboard.coveredCalls.find((c) => c.symbol === symbol);
        if (!candidate) return fail(400, { message: `Covered call candidate for ${symbol} not found.` });
        ticket = await coveredCallToTicket(user.id, candidate, dte);
      } else {
        const row = dashboard.puts.find((p) => p.symbol === symbol);
        if (!row) return fail(400, { message: `Put position ${symbol} not found.` });
        ticket = await cspToTicket(user.id, row, dte);
      }

      return { status: 'queued', ticket, dte };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Failed to queue option.' });
    }
  },

  executeOption: async ({ request }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    const ticketId = String(form.get('ticketId') ?? '');

    try {
      const ticket = await getTradeTicket(user.id, ticketId);
      if (!ticket) return fail(404, { message: 'Ticket not found.' });

      const meta = ticket.metadata as Record<string, unknown>;
      if (meta?.mode !== 'paper') {
        return fail(400, { message: 'Only paper mode tickets allowed here.' });
      }

      await approveTradeTicket(user.id, ticketId, 'Approved via options execute');
      const preview = await previewMoomooExecution(user.id, { tradeTicketId: ticketId, mode: 'paper' });

      if (preview.status === 'blocked') {
        const blocked = (preview.safetyChecks as ExecutionSafetyCheck[] | undefined)
          ?.find((c) => c.checkStatus === 'block');
        return fail(400, { message: `Execution blocked: ${blocked?.message ?? 'Safety check failed.'}` });
      }

      const submitted = await submitMoomooExecution(user.id, preview.id, { confirm: true });
      const sub = (submitted.submissions as Array<{ brokerOrderId?: string }> | undefined)?.[0];
      return {
        status: 'executed',
        message: `Option submitted to paper.${sub?.brokerOrderId ? ` Order ID: ${sub.brokerOrderId}` : ''}`,
        brokerOrderId: sub?.brokerOrderId ?? null,
        ticketId
      };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Option execution failed.' });
    }
  }
};
