import { fail, type Actions } from '@sveltejs/kit';
import {
  approveTradeTicket,
  cancelTradeTicket,
  createTradeTicket,
  getTradeLayerDashboard,
  parseTradeOrderType,
  parseTradeTicketType,
  rejectTradeTicket
} from '$lib/services/trade-layer.service';
import { previewMoomooExecution, submitMoomooExecution, type ExecutionSafetyCheck } from '$lib/services/moomoo-execution.service';
import { rateLimit } from '$lib/server/rate-limit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;
  return getTradeLayerDashboard(user.id);
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const user = locals.user!;
    const rl = rateLimit(`trade-ticket:${user.id}`, { limit: 10, windowMs: 60_000 });
    if (!rl.allowed) return fail(429, { message: 'Too many trade requests. Please wait a moment before trying again.' });
    const form = await request.formData();
    try {
      await createTradeTicket(user.id, formToTicketInput(form));
      return { status: 'created', message: 'Trade ticket created.' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Trade ticket creation failed.' });
    }
  },
  approve: async ({ request, locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    try {
      await approveTradeTicket(user.id, String(form.get('ticketId') ?? ''), String(form.get('note') ?? 'Approved for future execution review.'));
      return { status: 'approved', message: 'Ticket approved internally.' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Ticket approval failed.' });
    }
  },
  confirm_execute: async ({ request, locals }) => {
    const user = locals.user!;
    // §14 — tighter limit on the execution path than on plain ticket creation.
    const rl = rateLimit(`trade-exec:${user.id}`, { limit: 6, windowMs: 60_000 });
    if (!rl.allowed) return fail(429, { message: 'Too many execution attempts. Please wait a moment before trying again.' });
    const form = await request.formData();
    const ticketId = String(form.get('ticketId') ?? '');
    try {
      const ticket = await import('$lib/services/trade-layer.service').then(m => m.getTradeTicket(user.id, ticketId));
      if (!ticket) return fail(404, { message: 'Trade ticket not found.' });
      if (ticket.status === 'draft' || ticket.status === 'pending_approval') {
        await approveTradeTicket(user.id, ticketId, 'Confirmed and executed via paper trading.');
      }
      const execution = await previewMoomooExecution(user.id, { tradeTicketId: ticketId, mode: 'paper' });
      if (execution.status === 'blocked') {
        const blocked = (execution.safetyChecks as ExecutionSafetyCheck[] | undefined)?.find(c => c.checkStatus === 'block');
        return fail(400, { message: `Execution blocked: ${blocked?.message ?? 'Safety check failed.'}` });
      }
      const result = await submitMoomooExecution(user.id, execution.id, { confirm: true });
      const submission = (result.submissions as Array<{ brokerOrderId?: string }> | undefined)?.[0];
      return {
        status: 'executed',
        message: `Trade submitted to paper trading.${submission?.brokerOrderId ? ` Order ID: ${submission.brokerOrderId}` : ''}`,
        brokerOrderId: submission?.brokerOrderId ?? null,
        executionId: execution.id
      };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Execution failed.' });
    }
  },
  reject: async ({ request, locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    try {
      await rejectTradeTicket(user.id, String(form.get('ticketId') ?? ''), String(form.get('note') ?? 'Rejected after review.'));
      return { status: 'rejected', message: 'Ticket rejected.' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Ticket rejection failed.' });
    }
  },
  cancel: async ({ request, locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    try {
      await cancelTradeTicket(user.id, String(form.get('ticketId') ?? ''), String(form.get('note') ?? 'Cancelled by user.'));
      return { status: 'cancelled', message: 'Ticket cancelled.' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Ticket cancellation failed.' });
    }
  }
};

function formToTicketInput(form: FormData) {
  const orderType = parseTradeOrderType(form.get('orderType'));
  return {
    sourceType: String(form.get('sourceType') ?? 'manual'),
    sourceId: form.get('sourceId') ? String(form.get('sourceId')) : null,
    ticketType: parseTradeTicketType(form.get('ticketType')),
    symbol: String(form.get('symbol') ?? ''),
    quantity: Number(form.get('quantity') ?? 0),
    orderType,
    limitPrice: orderType === 'market' ? null : Number(form.get('limitPrice') ?? 0),
    thesis: String(form.get('thesis') ?? ''),
    metadata: { source: 'trade_layer_page' }
  };
}
