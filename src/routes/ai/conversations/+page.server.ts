import { listAiConversations } from '$lib/services/ai-copilot.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;
  return { user, conversations: await listAiConversations(user.id, 50) };
};
