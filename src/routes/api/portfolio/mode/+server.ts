import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  getUserPortfolioMode,
  saveUserPortfolioMode,
  parsePortfolioMode
} from '$lib/services/optimization-engine.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const user = await getDemoUser();
  const mode = await getUserPortfolioMode(user.id);
  return json({ mode });
};

export const PUT: RequestHandler = async ({ request }) => {
  const user = await getDemoUser();
  const body = await request.json().catch(() => ({}));
  const mode = parsePortfolioMode(body.mode);
  await saveUserPortfolioMode(user.id, mode);
  return json({ mode });
};
