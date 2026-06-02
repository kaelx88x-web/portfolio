import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toMoomooCode, expiryDte } from './stock-detail.service';

vi.mock('$lib/server/db', () => ({
  prisma: {
    asset: { findUnique: vi.fn() },
    transaction: { findMany: vi.fn() },
    watchlistItem: { findFirst: vi.fn() }
  }
}));
vi.mock('./broker.service', () => ({
  getQuoteSnapshots: vi.fn(), getStockBasicInfo: vi.fn(), getHistoricalCandles: vi.fn(),
  getCapitalFlow: vi.fn(), getMarketStates: vi.fn(), getPlateList: vi.fn(), getPlateStocks: vi.fn()
}));

import { buildStockDetail } from './stock-detail.service';
import { prisma } from '$lib/server/db';
import * as bs from './broker.service';

const mp = prisma as any;
const ASSET = { id: 'a1', symbol: 'NVDA', name: 'NVIDIA', country: 'US', exchange: 'NASDAQ', currency: 'USD', latestPrice: 170, sector: 'Tech', assetType: 'stock' };

function ok() {
  mp.asset.findUnique.mockResolvedValue(ASSET);
  mp.transaction.findMany.mockResolvedValue([]);
  mp.watchlistItem.findFirst.mockResolvedValue(null);
  (bs.getQuoteSnapshots as any).mockResolvedValue([{ code: 'US.NVDA', last_price: 170.5, prev_close_price: 167, bid_price: 170.4, ask_price: 170.6, volume: 1000 }]);
  (bs.getStockBasicInfo as any).mockResolvedValue([{ code: 'US.NVDA', pe_ttm: 55, pb_ratio: 40, eps: 3.1, market_cap: 4.1e12, high_52wk: 174, low_52wk: 80, lot_size: 1, error: null }]);
  (bs.getHistoricalCandles as any).mockResolvedValue([{ time_key: '2026-06-01', open: 168, close: 170, high: 171, low: 167 }]);
  (bs.getCapitalFlow as any).mockResolvedValue([{ code: 'US.NVDA', in_flow: 12, main_in_flow: 8, error: null }]);
  (bs.getMarketStates as any).mockResolvedValue([{ code: 'US.NVDA', market_state: 'MARKET_OPEN' }]);
  (bs.getPlateList as any).mockResolvedValue([{ code: 'US.SEMI', name: 'Semis', class: 'INDUSTRY' }]);
  (bs.getPlateStocks as any).mockResolvedValue([{ code: 'US.AMD', name: 'AMD', change_pct: 1.2, last_price: 160 }]);
}

describe('toMoomooCode', () => {
  it('US ticker → US. prefix', () => {
    expect(toMoomooCode('nvda', 'US')).toBe('US.NVDA');
    expect(toMoomooCode('AAPL', null)).toBe('US.AAPL'); // default US
  });
  it('HK numeric → HK. zero-padded to 5', () => {
    expect(toMoomooCode('700', 'HK')).toBe('HK.00700');
    expect(toMoomooCode('5', 'HK')).toBe('HK.00005');
  });
  it('MY numeric → MY. zero-padded to 4', () => {
    expect(toMoomooCode('1023', 'MY')).toBe('MY.1023');
    expect(toMoomooCode('23', 'MY')).toBe('MY.0023');
  });
  it('China A → SH/SZ by leading digit', () => {
    expect(toMoomooCode('600519', 'CN')).toBe('SH.600519');
    expect(toMoomooCode('000001', 'CN')).toBe('SZ.000001');
    expect(toMoomooCode('300750', 'CN')).toBe('SZ.300750'); // ChiNext → Shenzhen
  });
  it('already-prefixed code passes through', () => {
    expect(toMoomooCode('HK.00700', 'HK')).toBe('HK.00700');
    expect(toMoomooCode('US.NVDA', 'US')).toBe('US.NVDA');
  });
});

describe('expiryDte', () => {
  it('counts whole days to expiry', () => {
    expect(expiryDte('2026-07-02', new Date('2026-06-02T00:00:00Z'))).toBe(30);
  });
  it('today → 0', () => {
    expect(expiryDte('2026-06-02', new Date('2026-06-02T12:00:00Z'))).toBe(0);
  });
  it('already-expired contract → negative DTE', () => {
    expect(expiryDte('2026-05-30', new Date('2026-06-02T00:00:00Z'))).toBe(-3);
  });
});

describe('buildStockDetail', () => {
  beforeEach(() => { vi.clearAllMocks(); ok(); });

  it('returns 404-style null when asset not found', async () => {
    mp.asset.findUnique.mockResolvedValue(null);
    expect(await buildStockDetail('u', 'ZZZ')).toBeNull();
  });

  it('maps snapshot into an ok header block with change %', async () => {
    const vm = await buildStockDetail('u', 'NVDA');
    expect(vm!.header.status).toBe('ok');
    expect(vm!.header.data!.lastPrice).toBe(170.5);
    expect(Math.round(vm!.header.data!.changePct * 10) / 10).toBe(2.1);
  });

  it('header falls back to stale latestPrice when snapshot unavailable', async () => {
    (bs.getQuoteSnapshots as any).mockResolvedValue([]);
    const vm = await buildStockDetail('u', 'NVDA');
    expect(vm!.header.status).toBe('stale');
    expect(vm!.header.data!.lastPrice).toBe(170);
  });

  it('marks a block unavailable when its source returns empty', async () => {
    (bs.getStockBasicInfo as any).mockResolvedValue([]);
    const vm = await buildStockDetail('u', 'NVDA');
    expect(vm!.stats.status).toBe('unavailable');
    expect(vm!.stats.data).toBeNull();
  });

  it('never throws when a source rejects (degrades that block)', async () => {
    (bs.getCapitalFlow as any).mockRejectedValue(new Error('bridge down'));
    const vm = await buildStockDetail('u', 'NVDA');
    expect(vm!.flow.status).toBe('unavailable');
    expect(vm!.header.status).toBe('ok'); // other blocks unaffected
  });

  it('survives a DB failure on position/watchlist without crashing the page', async () => {
    mp.transaction.findMany.mockRejectedValue(new Error('db down'));
    mp.watchlistItem.findFirst.mockRejectedValue(new Error('db down'));
    const vm = await buildStockDetail('u', 'NVDA');
    expect(vm).not.toBeNull();
    expect(vm!.position).toBeNull();
    expect(vm!.watchlisted).toBe(false);
    expect(vm!.header.status).toBe('ok');
  });
});
