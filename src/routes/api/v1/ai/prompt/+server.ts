import { analyticsJson } from '$lib/server/analytics-api';
import {
  generatePrompt,
  parsePromptBenchmark,
  parsePromptPeriod,
  parsePromptProvider,
  parsePromptType
} from '$lib/services/prompt-builder.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user!;
  return analyticsJson(
    await generatePrompt(user.id, {
      promptType: parsePromptType(url.searchParams.get('promptType') ?? url.searchParams.get('prompt_type')),
      provider: parsePromptProvider(url.searchParams.get('provider')),
      model: url.searchParams.get('model') ?? undefined,
      question: url.searchParams.get('question') ?? undefined,
      period: parsePromptPeriod(url.searchParams.get('period')),
      benchmark: parsePromptBenchmark(url.searchParams.get('benchmark')),
      forceRefresh: url.searchParams.get('refresh') === 'true'
    })
  );
};
