import { getMoomooStatus, syncMoomoo } from '$lib/services/broker.service';
import { takeSnapshot, writeSyncLog } from '$lib/services/snapshot.service';
import { getDemoUser } from '$lib/server/demo-user';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const status = await getMoomooStatus().catch(() => null);
  return { status };
};

export const actions: Actions = {
  sync: async () => {
    const user = await getDemoUser();
    try {
      const result = await syncMoomoo();
      await takeSnapshot(user.id, result.holdings, result.account_info?.cash ?? 0);
      await writeSyncLog(user.id, 'success', result.holdings_count);
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
