import { aiContextJson } from '$lib/server/ai-context-api';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ url, locals }) => aiContextJson(locals.user!.id, url, 'full', true);
