import { aiContextJson } from '$lib/server/ai-context-api';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ url }) => aiContextJson(url, 'full', true);
