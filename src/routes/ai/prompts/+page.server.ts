import { getDemoUser } from '$lib/server/demo-user';
import {
  generatePrompt,
  listPromptTemplates,
  parsePromptProvider,
  parsePromptType,
  PROMPT_PROVIDERS,
  PROMPT_TYPES
} from '$lib/services/prompt-builder.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const user = await getDemoUser();
  const promptType = parsePromptType(url.searchParams.get('promptType') ?? url.searchParams.get('prompt_type'));
  const provider = parsePromptProvider(url.searchParams.get('provider'));
  const question = url.searchParams.get('question') ?? 'Review this portfolio.';
  const [templates, prompt] = await Promise.all([
    listPromptTemplates(),
    generatePrompt(user.id, { promptType, provider, question })
  ]);

  return {
    promptTypes: PROMPT_TYPES,
    providers: PROMPT_PROVIDERS,
    promptType,
    provider,
    question,
    templates,
    prompt
  };
};
