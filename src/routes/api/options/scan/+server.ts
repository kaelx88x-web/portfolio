// src/routes/api/options/scan/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getOptionScanQueue } from '$lib/server/queues';
export const POST: RequestHandler = async ({ locals }) => {
  const user = locals.user!;
  const userId = user.id;

  const queue = getOptionScanQueue();
  const job = await queue.add('manual-scan', {
    userId,
    triggeredBy: 'manual',
  });

  if (!job.id) {
    return json({ error: 'Queue did not assign a job ID' }, { status: 500 });
  }
  return json({ queued: true, jobId: job.id });
};
