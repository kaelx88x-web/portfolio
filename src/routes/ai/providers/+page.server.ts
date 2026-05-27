import { getAiOrchestrationOverview } from '$lib/services/ai-orchestration.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;
  return getAiOrchestrationOverview(user.id);
};
