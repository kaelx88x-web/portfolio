import { listSnapshots } from '$lib/services/snapshot.service';
import { getDemoUser } from '$lib/server/demo-user';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const user = await getDemoUser();
  const snapshots = await listSnapshots(user.id);
  return { snapshots };
};
