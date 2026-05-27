import { generatePromptJson } from '$lib/server/prompt-builder-api';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url, locals }) => generatePromptJson(locals.user!.id, request, url);
