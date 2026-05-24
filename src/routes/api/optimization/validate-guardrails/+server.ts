import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { getUserPortfolioMode } from '$lib/services/optimization-engine.service';
import { validatePortfolioGuardrails } from '$lib/services/guardrail.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const user = await getDemoUser();
  const mode = await getUserPortfolioMode(user.id);
  const report = await validatePortfolioGuardrails(user.id, mode);
  return json(report);
};

export const POST: RequestHandler = async ({ request }) => {
  const user = await getDemoUser();
  const body = await request.json().catch(() => ({}));
  const mode = await getUserPortfolioMode(user.id);
  const report = await validatePortfolioGuardrails(user.id, mode, body.constraints);
  return json(report);
};
