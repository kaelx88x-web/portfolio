import { fail, type Actions } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { listTradeTickets } from '$lib/services/trade-layer.service';
import {
  cancelMoomooExecution,
  getMoomooExecutionDashboard,
  parseExecutionMode,
  previewMoomooExecution,
  submitMoomooExecution
} from '$lib/services/moomoo-execution.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const user = await getDemoUser();
  const dashboard = await getMoomooExecutionDashboard(user.id);
  const tickets = await listTradeTickets(user.id, { status: 'approved', limit: 30 });
  return { ...dashboard, approvedTickets: tickets };
};

export const actions: Actions = {
  preview: async ({ request }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    try {
      await previewMoomooExecution(user.id, {
        tradeTicketId: String(form.get('tradeTicketId') ?? ''),
        mode: parseExecutionMode(form.get('mode')),
        overrideGuardrails: form.get('overrideGuardrails') === 'on'
      });
      return { status: 'previewed', message: 'Moomoo execution preview created.' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Execution preview failed.' });
    }
  },
  submit: async ({ request }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    try {
      await submitMoomooExecution(user.id, String(form.get('executionRequestId') ?? ''), {
        confirm: true,
        overrideGuardrails: form.get('overrideGuardrails') === 'on'
      });
      return { status: 'submitted', message: 'Execution request submitted or dry-run simulated.' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Execution submit failed.' });
    }
  },
  cancel: async ({ request }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    try {
      await cancelMoomooExecution(user.id, String(form.get('executionRequestId') ?? ''));
      return { status: 'cancelled', message: 'Execution request cancelled.' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Execution cancel failed.' });
    }
  }
};
