import { compressPromptJson } from '$lib/server/prompt-builder-api';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url }) => compressPromptJson(request, url);
