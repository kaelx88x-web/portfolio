import { analyticsJson } from '$lib/server/analytics-api';
import { getDemoUser } from '$lib/server/demo-user';
import {
  compressLivePromptContext,
  generatePrompt,
  getPromptTemplate,
  listPromptTemplates,
  parsePromptBenchmark,
  parsePromptPeriod,
  parsePromptProvider,
  parsePromptType,
  refreshPromptCache,
  type PromptBuilderOptions
} from '$lib/services/prompt-builder.service';

export async function listPromptsJson() {
  return analyticsJson({
    status: 'ready',
    prompts: await listPromptTemplates()
  });
}

export async function promptTemplateJson(slug: string) {
  return analyticsJson({
    status: 'ready',
    prompt: await getPromptTemplate(parsePromptType(slug))
  });
}

export async function generatePromptJson(request: Request, url: URL) {
  const user = await getDemoUser();
  const body = await readJsonBody(request);
  return analyticsJson(await generatePrompt(user.id, promptOptionsFromInput(url, body)));
}

export async function compressPromptJson(request: Request, url: URL) {
  const user = await getDemoUser();
  const body = await readJsonBody(request);
  return analyticsJson(await compressLivePromptContext(user.id, promptOptionsFromInput(url, body)));
}

export async function refreshPromptCacheJson() {
  const user = await getDemoUser();
  return analyticsJson(await refreshPromptCache(user.id));
}

export function promptOptionsFromInput(url: URL, body: Record<string, unknown> = {}): PromptBuilderOptions {
  const text = (key: string) => {
    const value = body[key];
    if (typeof value === 'string') return value;
    return url.searchParams.get(key);
  };

  const booleanValue = (key: string) => {
    const value = body[key];
    if (typeof value === 'boolean') return value;
    const query = url.searchParams.get(key);
    if (query === 'true') return true;
    if (query === 'false') return false;
    return undefined;
  };

  return {
    promptType: parsePromptType(text('promptType') ?? text('prompt_type')),
    provider: parsePromptProvider(text('provider')),
    model: text('model') ?? undefined,
    question: text('question') ?? undefined,
    period: parsePromptPeriod(text('period')),
    benchmark: parsePromptBenchmark(text('benchmark')),
    compression: booleanValue('compression'),
    forceRefresh: booleanValue('refresh') ?? booleanValue('forceRefresh')
  };
}

async function readJsonBody(request: Request) {
  try {
    const body = await request.json();
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
