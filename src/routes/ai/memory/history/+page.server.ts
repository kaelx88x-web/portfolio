import { getDemoUser } from '$lib/server/demo-user';
import { listAiMemorySnapshots, parseAiMemoryType } from '$lib/services/ai-memory.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const user = await getDemoUser();
  const snapshotType = parseAiMemoryType(url.searchParams.get('type'));
  return {
    snapshotType,
    history: await listAiMemorySnapshots(user.id, { snapshotType, limit: 40 })
  };
};
