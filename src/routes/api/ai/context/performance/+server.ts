import { aiContextJson } from '$lib/server/ai-context-api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => aiContextJson(url, 'performance');
