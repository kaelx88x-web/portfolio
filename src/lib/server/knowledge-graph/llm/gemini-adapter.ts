import type {
  CompanyEdgeDraft,
  EdgeClassificationInput,
  LLMProvider,
} from '../types';
import { sanitizeDrafts, buildClassificationPrompt } from './shared';

// Flat responseSchema — Gemini supports only a subset of JSON Schema and rejects
// deeply nested / large schemas, so we keep it to one array of flat objects.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sourceTicker: { type: 'string' },
          targetTicker: { type: 'string' },
          type: { type: 'string', enum: ['competitor', 'supplier', 'customer'] },
          confidence: { type: 'number' },
        },
        required: ['sourceTicker', 'targetTicker', 'type', 'confidence'],
      },
    },
  },
  required: ['edges'],
};

export class GeminiAdapter implements LLMProvider {
  readonly name = 'gemini' as const;

  async classifyEdges(input: EdgeClassificationInput): Promise<CompanyEdgeDraft[]> {
    if (input.candidatePairs.length === 0) return [];

    const model = process.env.KG_GEMINI_MODEL ?? 'gemini-flash-lite-latest';
    const key = process.env.GEMINI_API_KEY ?? '';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildClassificationPrompt(input) }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) return [];
      const payload = await res.json();
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
      let edges: unknown = [];
      try { edges = JSON.parse(text).edges ?? []; } catch { edges = []; }
      return sanitizeDrafts(edges, input);
    } catch {
      return [];
    }
  }
}
