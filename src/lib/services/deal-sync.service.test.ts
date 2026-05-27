import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing the service
vi.mock('$lib/server/db', () => ({
  prisma: {
    transaction: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
    asset: {
      upsert: vi.fn(),
    },
  },
}));

import { syncDealsToTransactions } from './deal-sync.service';
import { prisma } from '$lib/server/db';

const mockPrisma = prisma as {
  transaction: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; createMany: ReturnType<typeof vi.fn> };
  asset: { upsert: ReturnType<typeof vi.fn> };
};

const ASSET_STUB = { id: 'asset-1', symbol: 'PATH' };
const USER_ID = 'user-1';
const ACCOUNT_ID = 'acct-1';

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.asset.upsert.mockResolvedValue(ASSET_STUB);
  mockPrisma.transaction.create.mockResolvedValue({});
  mockPrisma.transaction.createMany.mockResolvedValue({ count: 0 });
});

describe('syncDealsToTransactions', () => {
  it('returns 0/0 for empty deals array', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    const result = await syncDealsToTransactions(USER_ID, ACCOUNT_ID, []);
    expect(result).toEqual({ inserted: 0, skipped: 0 });
    expect(mockPrisma.transaction.createMany).not.toHaveBeenCalled();
  });

  it('inserts a new BUY deal with lowercased type', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    mockPrisma.transaction.createMany.mockResolvedValue({ count: 1 });
    const result = await syncDealsToTransactions(USER_ID, ACCOUNT_ID, [
      {
        deal_id: 'deal-1',
        code: 'US.PATH',
        side: 'BUY',
        qty: 10,
        price: 15.5,
        create_time: '2025-06-01T10:00:00Z',
        fee: 0.5,
      },
    ]);
    expect(result).toEqual({ inserted: 1, skipped: 0 });
    expect(mockPrisma.transaction.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          userId: USER_ID,
          accountId: ACCOUNT_ID,
          assetId: 'asset-1',
          brokerDealId: 'deal-1',
          type: 'buy',
          quantity: 10,
          price: 15.5,
          fee: 0.5,
        }),
      ]),
    });
  });

  it('skips a deal whose deal_id is already stored', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([{ brokerDealId: 'deal-existing' }]);
    const result = await syncDealsToTransactions(USER_ID, ACCOUNT_ID, [
      {
        deal_id: 'deal-existing',
        code: 'US.AAPL',
        side: 'SELL',
        qty: 5,
        price: 200,
        create_time: '2025-06-01T10:00:00Z',
      },
    ]);
    expect(result).toEqual({ inserted: 0, skipped: 1 });
    expect(mockPrisma.transaction.createMany).not.toHaveBeenCalled();
  });

  it('strips prefix-format code correctly: US.PATH → PATH', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    await syncDealsToTransactions(USER_ID, ACCOUNT_ID, [
      {
        deal_id: 'deal-2',
        code: 'US.PATH',
        side: 'BUY',
        qty: 5,
        price: 10,
        create_time: '2025-06-01T10:00:00Z',
      },
    ]);
    expect(mockPrisma.asset.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { symbol: 'PATH' } }),
    );
  });

  it('skips deals with malformed timestamps', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    const result = await syncDealsToTransactions(USER_ID, ACCOUNT_ID, [
      {
        deal_id: 'deal-bad-time',
        code: 'US.NVDA',
        side: 'BUY',
        qty: 1,
        price: 100,
        create_time: 'not-a-date',
      },
    ]);
    expect(result).toEqual({ inserted: 0, skipped: 0 });
    expect(mockPrisma.transaction.createMany).not.toHaveBeenCalled();
  });
});
