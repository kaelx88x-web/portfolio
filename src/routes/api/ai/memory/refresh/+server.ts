import { refreshAiMemoryJson } from '$lib/server/ai-memory-api';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ url }) => refreshAiMemoryJson(url);
