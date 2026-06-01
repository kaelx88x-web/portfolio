import { prisma } from '$lib/server/db';

/**
 * The broker account currently selected in the topbar, used to scope
 * per-account views (dashboard, portfolio, analytics) to one account's
 * snapshots. Returns null when none is set (callers treat that as all-accounts).
 */
export async function getActiveBrokerAccId(userId: string): Promise<string | null> {
  const user = await prisma.user
    .findUnique({ where: { id: userId }, select: { activeBrokerAccId: true } })
    .catch(() => null);
  return user?.activeBrokerAccId ?? null;
}
