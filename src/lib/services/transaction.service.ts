import { prisma } from '$lib/server/db';

export async function listTransactions(
  userId: string,
  filters?: {
    accountId?: string | null;
    assetId?: string | null;
    type?: string | null;
    start?: string | null;
    end?: string | null;
  }
) {
  return prisma.transaction.findMany({
    where: {
      userId,
      accountId: filters?.accountId || undefined,
      assetId: filters?.assetId || undefined,
      type: filters?.type || undefined,
      tradeDate:
        filters?.start || filters?.end
          ? {
              gte: filters.start ? new Date(filters.start) : undefined,
              lte: filters.end ? new Date(filters.end) : undefined
            }
          : undefined
    },
    include: {
      account: true,
      asset: true
    },
    orderBy: { tradeDate: 'desc' }
  });
}

export async function createTransaction(input: {
  userId: string;
  accountId: string;
  assetId: string | null;
  type: string;
  tradeDate: Date;
  quantity: number;
  price: number;
  fee: number;
  currency: string;
  notes: string | null;
}) {
  return prisma.transaction.create({
    data: {
      ...input,
      type: input.type.toLowerCase()
    }
  });
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  input: {
    accountId: string;
    assetId: string | null;
    type: string;
    tradeDate: Date;
    quantity: number;
    price: number;
    fee: number;
    currency: string;
    notes: string | null;
  }
) {
  return prisma.transaction.update({
    where: { id_userId: { id: transactionId, userId } },
    data: {
      ...input,
      type: input.type.toLowerCase()
    }
  });
}

export async function deleteTransaction(userId: string, transactionId: string) {
  return prisma.transaction.delete({ where: { id_userId: { id: transactionId, userId } } });
}
