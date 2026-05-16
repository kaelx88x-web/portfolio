import { listPromptsJson } from '$lib/server/prompt-builder-api';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  return listPromptsJson();
};
