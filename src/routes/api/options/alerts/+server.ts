// src/routes/api/options/alerts/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { redisGet } from '$lib/server/redis';
import { redisKey } from '$lib/server/queues';
import { prisma } from '$lib/server/db';
import type { OptionAlert } from '$lib/server/queues';

export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user!;
  const userId = user.id;

  // Try Redis first (fast path)
  let alerts: OptionAlert[] = [];
  try {
    const cachedAlerts = await redisGet(redisKey.activeAlerts(userId));
    if (cachedAlerts) {
      alerts = JSON.parse(cachedAlerts) as OptionAlert[];
    } else {
      // Fallback: load recent unacknowledged alerts from DB
      const rows = await prisma.optionAlert.findMany({
        where: { userId, acknowledged: false },
        orderBy: { detectedAt: 'desc' },
        take: 50,
      });
      alerts = rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        symbol: row.symbol,
        optionType: row.optionType as OptionAlert['optionType'],
        severity: row.severity as OptionAlert['severity'],
        message: row.message,
        recommendation: row.recommendation,
        position: JSON.parse(row.positionJson),
        detectedAt: row.detectedAt.toISOString(),
        acknowledged: row.acknowledged,
      }));
    }
  } catch {
    // Redis unavailable — fall through to DB
    const rows = await prisma.optionAlert.findMany({
      where: { userId, acknowledged: false },
      orderBy: { detectedAt: 'desc' },
      take: 50,
    });
    alerts = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      symbol: row.symbol,
      optionType: row.optionType as OptionAlert['optionType'],
      severity: row.severity as OptionAlert['severity'],
      message: row.message,
      recommendation: row.recommendation,
      position: JSON.parse(row.positionJson),
      detectedAt: row.detectedAt.toISOString(),
      acknowledged: row.acknowledged,
    }));
  }

  let lastScan: string | null = null;
  try {
    lastScan = await redisGet(redisKey.lastScan(userId));
  } catch {
    // Redis unavailable — lastScan remains null
  }

  const count = {
    urgent: alerts.filter((a) => a.severity === 'urgent').length,
    profitable: alerts.filter((a) => a.severity === 'profitable').length,
    info: alerts.filter((a) => a.severity === 'info').length,
  };

  return json({ alerts, lastScan, count });
};
