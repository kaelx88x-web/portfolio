import { latestAiMemoryJson } from '$lib/server/ai-memory-api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => latestAiMemoryJson(url);
