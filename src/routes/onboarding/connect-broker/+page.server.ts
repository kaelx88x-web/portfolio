import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const isReconnect = url.searchParams.get('reconnect') === '1';

  // If already connected and not a reconnect flow, go straight to dashboard
  if (!isReconnect) {
    const dbUser = await prisma.user.findUnique({
      where: { id: locals.user!.id },
      select: { activeBrokerAccId: true },
    });
    if (dbUser?.activeBrokerAccId) {
      throw redirect(303, '/dashboard');
    }
  }

  return { isReconnect };
};
