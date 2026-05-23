// workers/alert-processor.worker.ts
// BullMQ Worker: persists individual alerts to MySQL via Prisma.
import 'dotenv/config';
import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { getWorkerConnection } from './connection.js';
import { QUEUE_OPTION_ALERTS } from '../src/lib/server/queues.js';
import type { ProcessAlertJobData } from '../src/lib/server/queues.js';

const prisma = new PrismaClient();

export function createAlertProcessorWorker() {
  const worker = new Worker<ProcessAlertJobData>(
    QUEUE_OPTION_ALERTS,
    async (job) => {
      const { userId, alert } = job.data;
      console.log(`[AlertProcessorWorker] job ${job.id} — ${alert.severity} alert for ${alert.symbol}`);

      await prisma.optionAlert.create({
        data: {
          userId,
          symbol: alert.symbol,
          optionType: alert.optionType,
          severity: alert.severity,
          message: alert.message,
          recommendation: alert.recommendation,
          positionJson: JSON.stringify(alert.position),
          detectedAt: new Date(alert.detectedAt),
          acknowledged: false,
        },
      });

      console.log(`[AlertProcessorWorker] alert persisted — ${alert.symbol} ${alert.severity}`);
    },
    {
      connection: getWorkerConnection(),
      concurrency: 5,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[AlertProcessorWorker] job ${job.id} completed`);
  });
  worker.on('failed', (job, err) => {
    console.error(`[AlertProcessorWorker] job ${job?.id} failed:`, err.message);
  });

  return { worker };
}
