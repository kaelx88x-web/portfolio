import { json } from '@sveltejs/kit';
import { getUserPortfolioMode } from '$lib/services/optimization-engine.service';
import { validatePortfolioGuardrails } from '$lib/services/guardrail.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user!;
  const mode = await getUserPortfolioMode(user.id);
  const report = await validatePortfolioGuardrails(user.id, mode);
  return json(report);
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user!;
  const body = await request.json().catch(() => ({}));
  const mode = await getUserPortfolioMode(user.id);
  const report = await validatePortfolioGuardrails(user.id, mode, body.constraints);
  return json(report);
};
