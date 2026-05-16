import { getDemoUser } from '$lib/server/demo-user';
import { listAiConversations } from '$lib/services/ai-copilot.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const user = await getDemoUser();
  return { user, conversations: await listAiConversations(user.id, 50) };
};
