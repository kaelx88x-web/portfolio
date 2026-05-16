import { aiMemoryHistoryJson, refreshAiMemoryJson } from '$lib/server/ai-memory-api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => aiMemoryHistoryJson(url);

export const POST: RequestHandler = async ({ url }) => refreshAiMemoryJson(url);
