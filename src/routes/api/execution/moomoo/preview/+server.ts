import { json } from '@sveltejs/kit';
import { parseExecutionMode, previewMoomooExecution } from '$lib/services/moomoo-execution.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user!;
  const body = await request.json().catch(() => ({}));
  try {
    const execution = await previewMoomooExecution(user.id, {
      tradeTicketId: String(body.tradeTicketId ?? ''),
      mode: parseExecutionMode(body.mode),
      overrideGuardrails: Boolean(body.overrideGuardrails)
    });
    return json({ status: execution.status, execution });
  } catch (error) {
    return json({ status: 'error', message: error instanceof Error ? error.message : 'Execution preview failed.' }, { status: 400 });
  }
};
