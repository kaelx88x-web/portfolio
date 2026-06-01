import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userUpdate: vi.fn(),
  accountUpsert: vi.fn(),
}));

vi.mock('$lib/server/db', () => ({
  prisma: {
    user: { update: mocks.userUpdate },
    account: { upsert: mocks.accountUpsert },
  },
}));

describe('[BLACK BOX] POST /api/broker/accounts/select', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userUpdate.mockResolvedValue({ id: 'user-1', activeBrokerAccId: '4652657' });
    mocks.accountUpsert.mockResolvedValue({ id: 'account-1' });
  });

  it('rejects unauthenticated users', async () => {
    const { POST } = await import('./+server');
    const request = jsonRequest({ acc_id: '4652657', trd_env: 'SIMULATE' });

    await expect(POST({ request, locals: {} } as any)).rejects.toMatchObject({ status: 401 });
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.accountUpsert).not.toHaveBeenCalled();
  });

  it('selects a broker paper account and creates the local account mapping', async () => {
    const { POST } = await import('./+server');
    const request = jsonRequest({
      acc_id: '4652657',
      trd_env: 'SIMULATE',
      name: 'Moomoo Paper',
      currency: 'USD',
    });

    const response = await POST({ request, locals: { user: { id: 'user-1' } } } as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, accountId: 'account-1' });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { activeBrokerAccId: '4652657', onboardingCompleted: true },
    });
    expect(mocks.accountUpsert).toHaveBeenCalledWith({
      where: { userId_brokerAccId: { userId: 'user-1', brokerAccId: '4652657' } },
      create: {
        userId: 'user-1',
        name: 'Moomoo Paper',
        brokerName: 'moomoo',
        accountType: 'paper',
        currency: 'USD',
        brokerAccId: '4652657',
      },
      update: {},
    });
  });

  it('selects a live account and sanitizes unsupported currency values', async () => {
    const { POST } = await import('./+server');
    const request = jsonRequest({
      acc_id: '987654321',
      trd_env: 'REAL',
      currency: 'BTC',
    });

    const response = await POST({ request, locals: { user: { id: 'user-1' } } } as any);

    expect(response.status).toBe(200);
    expect(mocks.accountUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        name: 'Live Account (987654321)',
        accountType: 'live',
        currency: 'USD',
      }),
    }));
  });

  it('rejects invalid broker environment values', async () => {
    const { POST } = await import('./+server');
    const request = jsonRequest({ acc_id: '4652657', trd_env: 'PAPER' });

    await expect(POST({ request, locals: { user: { id: 'user-1' } } } as any)).rejects.toMatchObject({ status: 400 });
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.accountUpsert).not.toHaveBeenCalled();
  });
});

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/broker/accounts/select', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
