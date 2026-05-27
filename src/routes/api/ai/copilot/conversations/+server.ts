import { json } from '@sveltejs/kit';
import { createAiConversation, listAiConversations } from '$lib/services/ai-copilot.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user!;
  return json({ status: 'ready', conversations: await listAiConversations(user.id) });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user!;
  const body = await request.json().catch(() => ({}));
  const conversation = await createAiConversation(user.id, body.title ?? 'Portfolio Copilot Chat', {
    source: 'api'
  });

  return json({ status: 'created', conversation }, { status: 201 });
};
