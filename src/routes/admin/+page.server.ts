// src/routes/admin/+page.server.ts
import { prisma } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

  const [totalUsers, activeUsers, bannedUsers, totalAccounts] = await Promise.all([
    prisma.user.count(),
    prisma.session.count({ where: { updatedAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { banned: true } }),
    prisma.account.count(),
  ]);

  // AUM via single raw SQL — avoids N+1/RAM spike
  const aumResult = await prisma.$queryRaw<[{ totalAum: number }]>`
    SELECT COALESCE(SUM(ps.totalValue), 0) AS totalAum
    FROM PortfolioSnapshot ps
    INNER JOIN (
      SELECT userId, MAX(createdAt) AS maxCreatedAt
      FROM PortfolioSnapshot
      GROUP BY userId
    ) latest ON ps.userId = latest.userId AND ps.createdAt = latest.maxCreatedAt
  `;
  const totalAum = Number(aumResult[0]?.totalAum ?? 0);

  // Bridge health check (fire-and-forget, don't block)
  let bridgeOnline = false;
  try {
    const res = await fetch('http://localhost:8888/health', { signal: AbortSignal.timeout(2000) });
    bridgeOnline = res.ok;
  } catch { /* offline */ }

  return { totalUsers, activeUsers, bannedUsers, totalAccounts, totalAum, bridgeOnline };
};
