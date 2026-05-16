import { prisma } from '$lib/server/db';
import type { MoomooSyncResult } from '$lib/types/portfolio';

export async function upsertMoomooAccount(userId: string, result: MoomooSyncResult): Promise<void> {
  const accountType = getMoomooAccountType(result);
  const environmentKey = normalizeMoomooEnvironment(result.trade_environment);
  const syntheticId = `moomoo-${userId}-${environmentKey.toLowerCase()}`;
  const fallbackName = accountType === 'brokerage' ? 'Moomoo Brokerage' : 'Moomoo Simulated';
  const name = result.account_label.replace(/\s+\(N\/A\)$/i, '').trim() || fallbackName;
  const holdingCurrencies = [...new Set(result.holdings.map((holding) => holding.currency).filter(Boolean))];
  const currency = holdingCurrencies.length === 1 ? holdingCurrencies[0] : 'USD';

  await prisma.account.upsert({
    where: { id_userId: { id: syntheticId, userId } },
    create: {
      id: syntheticId,
      userId,
      name,
      brokerName: 'Moomoo',
      accountType,
      currency
    },
    update: { name, accountType, currency }
  });
}

export function getMoomooAccountType(result: MoomooSyncResult) {
  return normalizeMoomooEnvironment(result.trade_environment) === 'REAL' ? 'brokerage' : 'paper';
}

function normalizeMoomooEnvironment(environment: string) {
  const value = environment.toUpperCase();
  if (value.includes('REAL')) return 'REAL';
  return 'SIMULATE';
}

export async function listAccounts(userId: string) {
  return prisma.account.findMany({
    where: { userId },
    orderBy: [{ brokerName: 'asc' }, { name: 'asc' }]
  });
}

export async function createAccount(input: {
  userId: string;
  name: string;
  brokerName: string;
  accountType: string;
  currency: string;
}) {
  return prisma.account.create({ data: input });
}

export async function updateAccount(
  userId: string,
  accountId: string,
  input: {
    name: string;
    brokerName: string;
    accountType: string;
    currency: string;
  }
) {
  return prisma.account.update({
    where: { id_userId: { id: accountId, userId } },
    data: input
  });
}

export async function deleteAccount(userId: string, accountId: string) {
  return prisma.account.delete({ where: { id_userId: { id: accountId, userId } } });
}
