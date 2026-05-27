import { aiHistoricalInsightsJson } from '$lib/server/ai-memory-api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => aiHistoricalInsightsJson(locals.user!.id);
