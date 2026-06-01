import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/db', () => ({
  prisma: {
    transaction: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

import { classifyContribution, syncCashFlowsToTransactions } from './cashflow-sync.service';
import { prisma } from '$lib/server/db';
import type { CashFlowItem } from '$lib/services/broker.service';

const mockPrisma = prisma as unknown as {
  transaction: { findMany: ReturnType<typeof vi.fn>; createMany: ReturnType<typeof vi.fn> };
};

const USER_ID = 'user-1';
const ACCOUNT_ID = 'acct-1';

function flow(partial: Partial<CashFlowItem>): CashFlowItem {
  return {
    cashflow_id: '1',
    clearing_date: '2026-05-29',
    settlement_date: '2026-05-29',
    currency: 'USD',
    cashflow_type: 'Others',
    cashflow_direction: 'IN',
    amount: 10,
    remark: '',
    ...partial,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.transaction.findMany.mockResolvedValue([]);
  mockPrisma.transaction.createMany.mockResolvedValue({ count: 0 });
});

describe('classifyContribution — only genuine capital flows count', () => {
  it('treats bank-transfer deposits/withdrawals as contributions', () => {
    expect(classifyContribution(flow({ cashflow_type: 'Bank Transfer Deposits' }))).toBe('deposit');
    expect(classifyContribution(flow({ cashflow_type: 'Bank Transfer Withdrawals' }))).toBe('withdrawal');
  });

  it('rejects trading / FX / income / fund / assignment rows', () => {
    for (const t of ['Others', 'Currency Exchange', 'Fund Dividend', 'Fund Redemption', 'Fund Subscription', 'Coupon', 'Stock {buy_sell} from Assign']) {
      expect(classifyContribution(flow({ cashflow_type: t })), t).toBeNull();
    }
  });
});

describe('syncCashFlowsToTransactions', () => {
  it('returns 0/0 for empty input', async () => {
    const r = await syncCashFlowsToTransactions(USER_ID, ACCOUNT_ID, []);
    expect(r).toEqual({ inserted: 0, skipped: 0 });
    expect(mockPrisma.transaction.createMany).not.toHaveBeenCalled();
  });

  it('inserts only the deposit, ignoring Others/FX noise', async () => {
    mockPrisma.transaction.createMany.mockResolvedValue({ count: 1 });
    const r = await syncCashFlowsToTransactions(USER_ID, ACCOUNT_ID, [
      flow({ cashflow_id: '100', cashflow_type: 'Bank Transfer Deposits', amount: 500 }),
      flow({ cashflow_id: '101', cashflow_type: 'Others', amount: 78 }),
      flow({ cashflow_id: '102', cashflow_type: 'Currency Exchange', amount: -9 }),
    ]);
    expect(r.inserted).toBe(1);
    const rows = mockPrisma.transaction.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'deposit',
      price: 500,
      fee: 0,
      assetId: null,
      brokerDealId: 'cf-100',
    });
  });

  it('stores withdrawal amount as a positive magnitude', async () => {
    mockPrisma.transaction.createMany.mockResolvedValue({ count: 1 });
    await syncCashFlowsToTransactions(USER_ID, ACCOUNT_ID, [
      flow({ cashflow_id: '200', cashflow_type: 'Bank Transfer Withdrawals', amount: -300, cashflow_direction: 'OUT' }),
    ]);
    const rows = mockPrisma.transaction.createMany.mock.calls[0][0].data;
    expect(rows[0]).toMatchObject({ type: 'withdrawal', price: 300, brokerDealId: 'cf-200' });
  });

  it('skips cash flows already stored (namespaced cf- id)', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([{ brokerDealId: 'cf-300' }]);
    const r = await syncCashFlowsToTransactions(USER_ID, ACCOUNT_ID, [
      flow({ cashflow_id: '300', cashflow_type: 'Bank Transfer Deposits', amount: 1000 }),
    ]);
    expect(r).toEqual({ inserted: 0, skipped: 1 });
    expect(mockPrisma.transaction.createMany).not.toHaveBeenCalled();
  });
});
