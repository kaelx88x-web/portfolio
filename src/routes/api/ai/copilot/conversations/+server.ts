import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { createAiConversation, listAiConversations } from '$lib/services/ai-copilot.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const user = await getDemoUser();
  return json({ status: 'ready', conversations: await listAiConversations(user.id) });
};

export const POST: RequestHandler = async ({ request }) => {
  const user = await getDemoUser();
  const body = await request.json().catch(() => ({}));
  const conversation = await createAiConversation(user.id, body.title ?? 'Portfolio Copilot Chat', {
    source: 'api'
  });

  return json({ status: 'created', conversation }, { status: 201 });
};
