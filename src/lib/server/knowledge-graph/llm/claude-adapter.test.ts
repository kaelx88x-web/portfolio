import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeAdapter } from './claude-adapter';
import type { EdgeClassificationInput } from '../types';

const input: EdgeClassificationInput = {
  companies: [
    { ticker: 'US.NVDA', name: 'NVIDIA', sector: 'Semis' },
    { ticker: 'US.TSM', name: 'TSMC', sector: 'Semis' },
    { ticker: 'US.AMD', name: 'AMD', sector: 'Semis' },
  ],
  candidatePairs: [
    { sourceTicker: 'US.AMD', targetTicker: 'US.NVDA' },
    { sourceTicker: 'US.NVDA', targetTicker: 'US.TSM' },
  ],
};

function claudeToolResponse(edges: unknown) {
  return {
    ok: true,
    json: async () => ({
      content: [{ type: 'tool_use', name: 'emit_edges', input: { edges } }],
      usage: { input_tokens: 10, output_tokens: 20 },
    }),
  } as Response;
}

describe('ClaudeAdapter', () => {
  beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'test-key'; });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns CompanyEdgeDraft[] with the exact schema shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(claudeToolResponse([
      { sourceTicker: 'US.AMD', targetTicker: 'US.NVDA', type: 'competitor', confidence: 0.9 },
      { sourceTicker: 'US.NVDA', targetTicker: 'US.TSM', type: 'supplier', confidence: 0.8 },
    ])));

    const out = await new ClaudeAdapter().classifyEdges(input);
    expect(out).toEqual([
      { sourceTicker: 'US.AMD', targetTicker: 'US.NVDA', type: 'competitor', confidence: 0.9 },
      { sourceTicker: 'US.NVDA', targetTicker: 'US.TSM', type: 'supplier', confidence: 0.8 },
    ]);
  });

  it('drops drafts referencing tickers not in the input', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(claudeToolResponse([
      { sourceTicker: 'US.AMD', targetTicker: 'US.NVDA', type: 'competitor', confidence: 0.9 },
      { sourceTicker: 'US.FAKE', targetTicker: 'US.NVDA', type: 'customer', confidence: 0.7 },
    ])));
    const out = await new ClaudeAdapter().classifyEdges(input);
    expect(out).toHaveLength(1);
    expect(out[0].sourceTicker).toBe('US.AMD');
  });

  it('drops drafts with an invalid type or out-of-range confidence', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(claudeToolResponse([
      { sourceTicker: 'US.AMD', targetTicker: 'US.NVDA', type: 'frenemy', confidence: 0.9 },
      { sourceTicker: 'US.NVDA', targetTicker: 'US.TSM', type: 'supplier', confidence: 1.4 },
    ])));
    const out = await new ClaudeAdapter().classifyEdges(input);
    expect(out).toEqual([]);
  });

  it('returns [] when no candidate pairs are given (no network call)', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const out = await new ClaudeAdapter().classifyEdges({ companies: input.companies, candidatePairs: [] });
    expect(out).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it('returns [] (graceful) when the API call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response));
    const out = await new ClaudeAdapter().classifyEdges(input);
    expect(out).toEqual([]);
  });
});
