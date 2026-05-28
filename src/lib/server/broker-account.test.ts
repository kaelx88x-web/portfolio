import { describe, it, expect } from 'vitest';
import type { User, Account } from '@prisma/client';

describe('Prisma schema broker fields', () => {
  it('User has activeBrokerAccId', () => {
    const u: Partial<User> = { activeBrokerAccId: '4652657' };
    expect(u.activeBrokerAccId).toBe('4652657');
  });
  it('Account has brokerAccId', () => {
    const a: Partial<Account> = { brokerAccId: '4652657' };
    expect(a.brokerAccId).toBe('4652657');
  });
});
