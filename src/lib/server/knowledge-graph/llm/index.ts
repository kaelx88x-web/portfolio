import { env } from '$env/dynamic/private';
import type { LLMProvider } from '../types';
import { ClaudeAdapter } from './claude-adapter';
import { GeminiAdapter } from './gemini-adapter';

/**
 * Returns the configured LLM provider, or null when the chosen provider has no
 * API key (semantic layer is then skipped; structural edges still render).
 * Swap providers with a single env change: LLM_PROVIDER=claude|gemini.
 */
export function getLLMProvider(): LLMProvider | null {
  const provider = (env.LLM_PROVIDER ?? 'claude').toLowerCase();
  if (provider === 'gemini') {
    return env.GEMINI_API_KEY ? new GeminiAdapter() : null;
  }
  return env.ANTHROPIC_API_KEY ? new ClaudeAdapter() : null;
}
