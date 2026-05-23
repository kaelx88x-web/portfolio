// workers/option-scanner.worker.ts
// BullMQ Worker: processes options-scan jobs.
// Reads option positions from DB, detects alerts, enqueues alert jobs.
import 'dotenv/config';
import { Worker, Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { getWorkerConnection } from './connection.js';
import { QUEUE_OPTIONS_SCAN, QUEUE_OPTION_ALERTS, redisKey, redisTTL } from '../src/lib/server/queues.js';
import { detectAlerts, fromDbOptionsPosition } from '../src/lib/services/option-scanner.service.js';
import type { ScanOptionsJobData, ProcessAlertJobData } from '../src/lib/server/queues.js';

const prisma = new PrismaClient();

export function createOptionScannerWorker() {
  const connection = getWorkerConnection();
  const alertsQueue = new Queue<ProcessAlertJobData>(QUEUE_OPTION_ALERTS, { connection });
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<ScanOptionsJobData>(
    QUEUE_OPTIONS_SCAN,
    async (job) => {
      const { userId, triggeredBy } = job.data;
      console.log(`[OptionScannerWorker] job ${job.id} — userId=${userId} triggeredBy=${triggeredBy}`);

      // Fetch option positions from DB
      let positions = [];
      try {
        const rows = await prisma.optionsPosition.findMany({
          where: { userId, status: 'active' },
        });
        positions = rows.map(fromDbOptionsPosition);
        console.log(`[OptionScannerWorker] ${positions.length} active option positions found`);
      } catch (err) {
        console.error('[OptionScannerWorker] DB fetch error:', (err as Error).message);
        // Non-fatal — no positions means no alerts
      }

      // Cache positions in Redis
      try {
        await redis.setex(
          redisKey.positions(userId),
          redisTTL.positions,
          JSON.stringify(positions),
        );
        await redis.setex(
          redisKey.lastScan(userId),
          redisTTL.lastScan,
          new Date().toISOString(),
        );
      } catch (err) {
        console.warn('[OptionScannerWorker] Redis cache write failed:', (err as Error).message);
      }

      // Detect alerts
      const alerts = detectAlerts(positions, userId);
      console.log(`[OptionScannerWorker] ${alerts.length} alert(s) detected`);

      // Enqueue each alert for processing
      for (const alert of alerts) {
        await alertsQueue.add('process-alert', { userId, alert });
      }

      // Cache active alerts in Redis
      try {
        await redis.setex(
          redisKey.activeAlerts(userId),
          redisTTL.activeAlerts,
          JSON.stringify(alerts),
        );
      } catch (err) {
        console.warn('[OptionScannerWorker] Redis alert cache write failed:', (err as Error).message);
      }
    },
    {
      connection,
      concurrency: 1,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[OptionScannerWorker] job ${job.id} completed`);
  });
  worker.on('failed', (job, err) => {
    console.error(`[OptionScannerWorker] job ${job?.id} failed:`, err.message);
  });

  return { worker, redis, alertsQueue };
}
