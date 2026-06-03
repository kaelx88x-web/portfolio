// src/routes/paper-trading/paper-safety.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('$lib/services/price-audit.service', () => ({ recordPriceAudit: vi.fn(async () => ({})) }));
const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ broker_order_id: 'x', status: 'submitted' }) }));
vi.stubGlobal('fetch', fetchMock);

import { actions } from './+page.server';

function fd(map: Record<string, string>) { const f = new FormData(); for (const k in map) f.set(k, map[k]); return f; }
beforeEach(() => fetchMock.mockClear());

describe('paper submitOrder safety', () => {
  it('always targets the SIMULATE env, never LIVE', async () => {
    await actions.submitOrder({ request: { formData: async () => fd({ asset_type: 'stock', side: 'BUY', symbol: 'NVDA', qty: '1', price: '100' }) }, locals: { user: { id: 'u1' } } } as never);
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.trade_env).toBe('SIMULATE');
    expect(sentBody.dry_run).toBe(false);
  });
});
