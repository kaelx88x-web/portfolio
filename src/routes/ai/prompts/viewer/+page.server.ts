import {
  generatePrompt,
  parsePromptProvider,
  parsePromptType,
  PROMPT_PROVIDERS,
  PROMPT_TYPES
} from '$lib/services/prompt-builder.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
  const user = locals.user!;
  const promptType = parsePromptType(url.searchParams.get('promptType') ?? url.searchParams.get('prompt_type'));
  const provider = parsePromptProvider(url.searchParams.get('provider'));
  const question = url.searchParams.get('question') ?? 'Review this portfolio.';

  return {
    promptTypes: PROMPT_TYPES,
    providers: PROMPT_PROVIDERS,
    promptType,
    provider,
    question,
    prompt: await generatePrompt(user.id, {
      promptType,
      provider,
      question,
      compression: url.searchParams.get('compression') !== 'false'
    })
  };
};
