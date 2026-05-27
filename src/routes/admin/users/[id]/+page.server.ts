// src/routes/admin/users/[id]/+page.server.ts
import { prisma } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      banned: true,
      banReason: true,
      emailVerified: true,
      onboardingCompleted: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) throw error(404, 'User not found');

  const [accounts, latestSnapshot] = await Promise.all([
    prisma.account.findMany({ where: { userId: params.id } }),
    prisma.portfolioSnapshot.findFirst({
      where: { userId: params.id },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return { targetUser: user, accounts, latestSnapshot };
};
