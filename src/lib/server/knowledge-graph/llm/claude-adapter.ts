import type {
  CompanyEdgeDraft,
  EdgeClassificationInput,
  LLMProvider,
} from '../types';
import { sanitizeDrafts, buildClassificationPrompt } from './shared';

const EDGES_TOOL = {
  name: 'emit_edges',
  description: 'Return the classified directed relationships between the given companies.',
  input_schema: {
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
  },
} as const;

export class ClaudeAdapter implements LLMProvider {
  readonly name = 'claude' as const;

  async classifyEdges(input: EdgeClassificationInput): Promise<CompanyEdgeDraft[]> {
    if (input.candidatePairs.length === 0) return [];

    const model = process.env.KG_CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001';
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: Number(process.env.KG_MAX_TOKENS ?? 2000),
          tools: [EDGES_TOOL],
          tool_choice: { type: 'tool', name: 'emit_edges' },
          messages: [{ role: 'user', content: buildClassificationPrompt(input) }],
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) return [];
      const payload = await res.json();
      const block = (payload.content ?? []).find(
        (b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'emit_edges'
      );
      const edges = block?.input?.edges ?? [];
      return sanitizeDrafts(edges, input);
    } catch {
      return []; // graceful: structural edges still render
    }
  }
}
