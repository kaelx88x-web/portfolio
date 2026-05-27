import { listSnapshots } from '$lib/services/snapshot.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;
  const snapshots = await listSnapshots(user.id);
  return { snapshots };
};
