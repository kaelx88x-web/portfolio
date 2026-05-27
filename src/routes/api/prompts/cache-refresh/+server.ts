import { refreshPromptCacheJson } from '$lib/server/prompt-builder-api';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => refreshPromptCacheJson(locals.user!.id);
