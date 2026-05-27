import { aiMemoryHistoryJson, refreshAiMemoryJson } from '$lib/server/ai-memory-api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => aiMemoryHistoryJson(locals.user!.id, url);

export const POST: RequestHandler = async ({ url, locals }) => refreshAiMemoryJson(locals.user!.id, url);
