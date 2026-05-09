import { prisma } from '$lib/server/db';

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
