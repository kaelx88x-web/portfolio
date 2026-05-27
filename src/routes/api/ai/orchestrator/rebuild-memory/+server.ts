import { json } from '@sveltejs/kit';
import { rebuildAiOrchestrationMemory } from '$lib/services/ai-orchestration.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
  const user = locals.user!;
  const memory = await rebuildAiOrchestrationMemory(user.id);

  return json({ status: 'rebuilt', memory });
};
