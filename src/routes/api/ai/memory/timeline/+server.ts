import { aiMemoryTimelineJson } from '$lib/server/ai-memory-api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => aiMemoryTimelineJson(locals.user!.id);
