import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { rebuildAiOrchestrationMemory } from '$lib/services/ai-orchestration.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
  const user = await getDemoUser();
  const memory = await rebuildAiOrchestrationMemory(user.id);

  return json({ status: 'rebuilt', memory });
};
