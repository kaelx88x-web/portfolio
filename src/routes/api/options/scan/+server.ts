// src/routes/api/options/scan/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getOptionScanQueue } from '$lib/server/queues';
import { getDemoUser } from '$lib/server/demo-user';

export const POST: RequestHandler = async () => {
  const user = await getDemoUser();
  const userId = user.id;

  const queue = getOptionScanQueue();
  const job = await queue.add('manual-scan', {
    userId,
    triggeredBy: 'manual',
  });

  return json({ queued: true, jobId: job.id });
};
