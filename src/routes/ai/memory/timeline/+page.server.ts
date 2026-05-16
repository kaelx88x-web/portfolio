import { getDemoUser } from '$lib/server/demo-user';
import { listAiHistoricalInsights, listAiMemoryTimeline } from '$lib/services/ai-memory.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const user = await getDemoUser();
  const [timeline, insights] = await Promise.all([
    listAiMemoryTimeline(user.id, 80),
    listAiHistoricalInsights(user.id, 30)
  ]);

  return { timeline, insights };
};
