import type { Handle, HandleServerError } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { getRecommendedStrategy } from '$lib/services/behavioral-profile.service';

export const handle: Handle = async ({ event, resolve }) => {
  if (event.request.method === 'GET' && event.url.pathname.startsWith('/optimization')) {
    const user = await getDemoUser();
    event.locals.recommendedStrategy = await getRecommendedStrategy(user.id).catch(() => undefined);
  }

  return resolve(event);
};

export const handleError: HandleServerError = ({ error, event }) => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[SvelteKit 500] ${event.url.pathname} — ${message}`);
  if (stack) console.error(stack);
  return { message };
};
