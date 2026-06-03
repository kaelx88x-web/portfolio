import { describe, it, expect, vi, beforeEach } from 'vitest';

const getQuotes = vi.fn();
vi.mock('$lib/server/market-data', () => ({ getProvider: () => ({ name: 'yahoo', getQuotes, getCandles: vi.fn() }) }));
vi.mock('$lib/server/quote-cache', () => ({ cached: (_k: string, _t: number, fn: () => unknown) => fn() }));

import { GET } from './+server';

function req(codes: string) {
  return { url: new URL(`http://x/api/quotes/live?codes=${codes}`), locals: { user: { id: 'u1' } } } as never;
}

beforeEach(() => getQuotes.mockReset());

describe('GET /api/quotes/live', () => {
  it('dedupes codes and returns quotes', async () => {
    getQuotes.mockResolvedValue([{ symbol: 'US.NVDA', last: 1, session: 'regular', source: 'yahoo', ts: 1 }]);
    const res = await GET(req('US.NVDA,US.NVDA'));
    const body = await res.json();
    expect(getQuotes).toHaveBeenCalledWith(['US.NVDA']);
    expect(body.quotes).toHaveLength(1);
  });

  it('returns empty quotes for no codes without calling provider', async () => {
    const res = await GET(req(''));
    const body = await res.json();
    expect(getQuotes).not.toHaveBeenCalled();
    expect(body.quotes).toEqual([]);
  });
});
