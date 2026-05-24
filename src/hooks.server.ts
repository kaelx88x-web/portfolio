import type { Handle } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { getRecommendedStrategy } from '$lib/services/behavioral-profile.service';

export const handle: Handle = async ({ event, resolve }) => {
  if (event.request.method === 'GET' && event.url.pathname.startsWith('/optimization')) {
    const user = await getDemoUser();
    event.locals.recommendedStrategy = await getRecommendedStrategy(user.id).catch(() => undefined);
  }

  return resolve(event);
};
