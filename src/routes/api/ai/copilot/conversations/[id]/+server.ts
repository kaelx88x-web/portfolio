import { error, json } from '@sveltejs/kit';
import { getAiConversation } from '$lib/services/ai-copilot.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  const user = locals.user!;
  const conversation = await getAiConversation(user.id, params.id);
  if (!conversation) throw error(404, 'Conversation not found.');

  return json({ status: 'ready', conversation });
};
