import { listAiMemorySnapshots, parseAiMemoryType } from '$lib/services/ai-memory.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
  const user = locals.user!;
  const snapshotType = parseAiMemoryType(url.searchParams.get('type'));
  return {
    snapshotType,
    history: await listAiMemorySnapshots(user.id, { snapshotType, limit: 40 })
  };
};
