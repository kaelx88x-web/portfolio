import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiAdapter } from './gemini-adapter';
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

function geminiJsonResponse(edges: unknown) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ edges }) }] } }],
    }),
  } as Response;
}

describe('GeminiAdapter', () => {
  beforeEach(() => { process.env.GEMINI_API_KEY = 'test-key'; });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns CompanyEdgeDraft[] with the identical shape to Claude', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiJsonResponse([
      { sourceTicker: 'US.AMD', targetTicker: 'US.NVDA', type: 'competitor', confidence: 0.9 },
      { sourceTicker: 'US.NVDA', targetTicker: 'US.TSM', type: 'supplier', confidence: 0.8 },
    ])));
    const out = await new GeminiAdapter().classifyEdges(input);
    expect(out).toEqual([
      { sourceTicker: 'US.AMD', targetTicker: 'US.NVDA', type: 'competitor', confidence: 0.9 },
      { sourceTicker: 'US.NVDA', targetTicker: 'US.TSM', type: 'supplier', confidence: 0.8 },
    ]);
  });

  it('drops drafts referencing unknown tickers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiJsonResponse([
      { sourceTicker: 'US.GHOST', targetTicker: 'US.NVDA', type: 'competitor', confidence: 0.9 },
    ])));
    const out = await new GeminiAdapter().classifyEdges(input);
    expect(out).toEqual([]);
  });

  it('returns [] when there are no candidate pairs (no network call)', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const out = await new GeminiAdapter().classifyEdges({ companies: input.companies, candidatePairs: [] });
    expect(out).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it('returns [] (graceful) when the API call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 } as Response));
    const out = await new GeminiAdapter().classifyEdges(input);
    expect(out).toEqual([]);
  });
});
