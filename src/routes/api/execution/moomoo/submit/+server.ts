import { json } from '@sveltejs/kit';
import { submitMoomooExecution } from '$lib/services/moomoo-execution.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user!;
  const body = await request.json().catch(() => ({}));
  try {
    const execution = await submitMoomooExecution(user.id, String(body.executionRequestId ?? ''), {
      confirm: Boolean(body.confirm),
      overrideGuardrails: Boolean(body.overrideGuardrails)
    });
    return json({ status: execution.status, execution });
  } catch (error) {
    return json({ status: 'error', message: error instanceof Error ? error.message : 'Execution submit failed.' }, { status: 400 });
  }
};
