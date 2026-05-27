import { json } from '@sveltejs/kit';
import {
  getUserPortfolioMode,
  saveUserPortfolioMode,
  parsePortfolioMode
} from '$lib/services/optimization-engine.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user!;
  const mode = await getUserPortfolioMode(user.id);
  return json({ mode });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
  const user = locals.user!;
  const body = await request.json().catch(() => ({}));
  const mode = parsePortfolioMode(body.mode);
  await saveUserPortfolioMode(user.id, mode);
  return json({ mode });
};
