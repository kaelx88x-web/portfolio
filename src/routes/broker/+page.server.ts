import { getMoomooStatus, syncMoomoo } from '$lib/services/broker.service';
import { getAgentStatus } from '$lib/services/agent.service';
import { takeSnapshot, writeSyncLog } from '$lib/services/snapshot.service';import { getOptionScanQueue } from '$lib/server/queues';
import { prisma } from '$lib/server/db';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;
  const [status, syncLogs, agentStatus] = await Promise.all([
    getMoomooStatus().catch(() => null),
    prisma.brokerSyncLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }).catch(() => []),
    getAgentStatus(user.id).catch(() => null),
  ]);
  return { status, syncLogs, agentStatus };
};

export const actions: Actions = {
  sync: async ({ locals }) => {
    const user = locals.user!;
    try {
      const result = await syncMoomoo();
      await takeSnapshot(user.id, result.holdings, result.account_info?.cash ?? 0, result.account_info?.total_assets || undefined);
      await writeSyncLog(user.id, 'success', result.holdings_count);

      // Enqueue option alert scan after successful sync
      try {
        const queue = getOptionScanQueue();
        await queue.add('moomoo-sync-scan', {
          userId: user.id,
          triggeredBy: 'moomoo-sync',
        });
        console.log('[broker] Option scan job enqueued after moomoo sync');
      } catch (err) {
        // Non-fatal — sync succeeded, alert scan can be triggered manually
        console.warn('[broker] Failed to enqueue option scan:', (err as Error).message);
      }

      return {
        success: true,
        message: `Synced ${result.holdings_count} holdings from ${result.account_label}.`,
        synced_at: result.synced_at,
        holdings: result.holdings,
        account_info: result.account_info
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed.';
      await writeSyncLog(user.id, 'failed', 0, msg).catch(() => {});
      return fail(400, { success: false, message: msg, holdings: [] });
    }
  }
};
