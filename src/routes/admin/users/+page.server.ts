// src/routes/admin/users/+page.server.ts
import { prisma } from '$lib/server/db';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const filter = url.searchParams.get('filter');
  const search = url.searchParams.get('search') ?? '';

  const where: Record<string, unknown> = {};
  if (filter === 'banned') where.banned = true;
  if (search) {
    where.OR = [
      { email: { contains: search } },
      { name: { contains: search } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      banned: true,
      banReason: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return { users, filter, search };
};

export const actions: Actions = {
  ban: async ({ request }) => {
    const data = await request.formData();
    const userId = data.get('userId') as string;
    const reason = (data.get('reason') as string) || 'Banned by admin';
    await prisma.user.update({ where: { id: userId }, data: { banned: true, banReason: reason } });
    // Revoke all sessions for that user
    await prisma.session.deleteMany({ where: { userId } });
    return { success: true };
  },

  unban: async ({ request }) => {
    const data = await request.formData();
    const userId = data.get('userId') as string;
    await prisma.user.update({ where: { id: userId }, data: { banned: false, banReason: null } });
    return { success: true };
  },
};
