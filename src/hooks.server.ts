// src/hooks.server.ts
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { prisma } from '$lib/server/db';
import { getRecommendedStrategy } from '$lib/services/behavioral-profile.service';
import { requiresBrokerGate, BROKER_ONBOARDING_PATHS } from '$lib/server/broker-gate';

const PUBLIC_PATHS = ['/login', '/register', '/api/auth'];

export const handle: Handle = async ({ event, resolve }) => {
  // 1. Validate session and set locals
  const session = await auth.api.getSession({ headers: event.request.headers });
  event.locals.user = session?.user ?? null;
  event.locals.session = session?.session ?? null;

  // 2. Kick banned users — delete their sessions from the database immediately
  if (event.locals.user?.banned) {
    await prisma.session.deleteMany({ where: { userId: event.locals.user.id } }).catch(() => {});
    throw redirect(303, '/login?error=banned');
  }

  // 3. Require auth for all non-public routes
  const isPublic = PUBLIC_PATHS.some((p) => event.url.pathname.startsWith(p));
  if (!event.locals.user && !isPublic) {
    throw redirect(303, '/login');
  }

  // 4. Require broker connection for all protected routes
  if (event.locals.user && requiresBrokerGate(event.url.pathname, PUBLIC_PATHS, BROKER_ONBOARDING_PATHS)) {
    const dbUser = await prisma.user.findUnique({
      where: { id: event.locals.user.id },
      select: { activeBrokerAccId: true },
    });
    if (!dbUser?.activeBrokerAccId) {
      throw redirect(303, '/onboarding/connect-broker');
    }
  }

  // 5. Admin-only guard
  if (event.url.pathname.startsWith('/admin') && event.locals.user?.role !== 'admin') {
    throw redirect(303, '/dashboard');
  }

  // 6. Keep existing recommendedStrategy for /optimization routes
  if (event.request.method === 'GET' && event.url.pathname.startsWith('/optimization') && event.locals.user) {
    event.locals.recommendedStrategy = await getRecommendedStrategy(event.locals.user.id).catch(() => undefined);
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
