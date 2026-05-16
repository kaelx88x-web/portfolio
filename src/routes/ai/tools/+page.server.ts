import { getDemoUser } from '$lib/server/demo-user';
import { getAiOrchestrationOverview } from '$lib/services/ai-orchestration.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const user = await getDemoUser();
  return getAiOrchestrationOverview(user.id);
};
