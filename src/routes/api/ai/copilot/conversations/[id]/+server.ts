import { error, json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { getAiConversation } from '$lib/services/ai-copilot.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const user = await getDemoUser();
  const conversation = await getAiConversation(user.id, params.id);
  if (!conversation) throw error(404, 'Conversation not found.');

  return json({ status: 'ready', conversation });
};
