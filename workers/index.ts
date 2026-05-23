// workers/index.ts
// Entry point — starts both BullMQ workers and registers the 15-minute repeatable scan.
import 'dotenv/config';
import { Queue } from 'bullmq';
import { getWorkerConnection } from './connection.js';
import { createOptionScannerWorker } from './option-scanner.worker.js';
import { createAlertProcessorWorker } from './alert-processor.worker.js';
import { QUEUE_OPTIONS_SCAN } from '../src/lib/server/queues.js';
import type { ScanOptionsJobData } from '../src/lib/server/queues.js';

console.log('[Workers] Starting option alert workers...');

const { worker: scanWorker, redis, alertsQueue } = createOptionScannerWorker();
const { worker: alertWorker } = createAlertProcessorWorker();

// Register 15-minute repeatable scan
// Uses a placeholder userId — real userId is injected when the moomoo sync triggers a manual job
const scanQueue = new Queue<ScanOptionsJobData>(QUEUE_OPTIONS_SCAN, {
  connection: getWorkerConnection(),
});

async function registerRepeatableScan() {
  // Remove existing repeatable jobs to avoid duplicates on restart
  const repeatableJobs = await scanQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === 'scheduled-scan') {
      await scanQueue.removeRepeatableByKey(job.key);
    }
  }

  await scanQueue.add(
    'scheduled-scan',
    { userId: 'system', triggeredBy: 'schedule' },
    {
      repeat: { every: 15 * 60 * 1000 }, // 15 minutes in ms
    },
  );
  console.log('[Workers] 15-minute repeatable scan registered');
}

registerRepeatableScan().catch((err) => {
  console.error('[Workers] Failed to register repeatable scan:', err.message);
});

// Graceful shutdown
async function shutdown() {
  console.log('[Workers] Shutting down...');
  await scanWorker.close();
  await alertWorker.close();
  await alertsQueue.close();
  await scanQueue.close();
  await redis.quit();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[Workers] Option scanner worker running (concurrency: 1)');
console.log('[Workers] Alert processor worker running (concurrency: 5)');
