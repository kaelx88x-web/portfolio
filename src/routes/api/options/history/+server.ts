// src/routes/api/options/history/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db';
import { getDemoUser } from '$lib/server/demo-user';

export const GET: RequestHandler = async ({ url }) => {
  const user = await getDemoUser();
  const userId = user.id;

  const rawLimit = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const limit = Math.min(isNaN(rawLimit) ? 20 : rawLimit, 100);
  const acknowledgedParam = url.searchParams.get('acknowledged');
  const acknowledgedFilter =
    acknowledgedParam === null ? undefined : acknowledgedParam === 'true';

  const rows = await prisma.optionAlert.findMany({
    where: {
      userId,
      ...(acknowledgedFilter !== undefined ? { acknowledged: acknowledgedFilter } : {}),
    },
    orderBy: { detectedAt: 'desc' },
    take: limit,
  });

  const history = rows.map((row) => ({
    id: row.id,
    symbol: row.symbol,
    optionType: row.optionType,
    severity: row.severity,
    message: row.message,
    recommendation: row.recommendation,
    detectedAt: row.detectedAt.toISOString(),
    acknowledged: row.acknowledged,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
  }));

  return json({ history, total: history.length });
};
