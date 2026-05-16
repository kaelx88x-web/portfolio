import { promptTemplateJson } from '$lib/server/prompt-builder-api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => promptTemplateJson(params.slug);
