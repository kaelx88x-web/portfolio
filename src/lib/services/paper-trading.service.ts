import { prisma } from '$lib/server/db';
import { findOrCreateAsset } from '$lib/services/asset.service';
import { createTransaction, listTransactions } from '$lib/services/transaction.service';
import { getHoldings } from '$lib/services/portfolio.service';

const STARTING_PAPER_CASH = 100_000;

export async function ensurePaperAccount(userId: string) {
  const existing = await prisma.account.findFirst({
    where: { userId, accountType: 'paper' },
    orderBy: { createdAt: 'asc' }
  });

  const account =
    existing ??
    (await prisma.account.create({
      data: {
        id: `paper-${userId}`,
        userId,
        name: 'Paper Trading Sandbox',
        brokerName: 'Portfolio AI',
        accountType: 'paper',
        currency: 'USD'
      }
    }));

  await ensurePaperFunding(userId, account.id, account.currency);
  return account;
}

export async function listTradingAccounts(userId: string) {
  const accounts = await prisma.account.findMany({
    where: { userId },
    orderBy: [{ accountType: 'desc' }, { name: 'asc' }]
  });

  return accounts.map((account) => ({
    ...account,
    mode: account.accountType === 'paper' ? 'sandbox' : 'read-only',
    canTrade: account.accountType === 'paper'
  }));
}

export async function getPaperDashboard(userId: string, activeAccountId?: string | null) {
  const fallbackPaper = await ensurePaperAccount(userId);
  const accounts = await listTradingAccounts(userId);
  const activeAccount =
    accounts.find((account) => account.id === activeAccountId) ??
    accounts.find((account) => account.id === fallbackPaper.id) ??
    accounts[0];

  const [allHoldings, transactions] = await Promise.all([
    getHoldings(userId),
    listTransactions(userId, { accountId: activeAccount.id })
  ]);

  const holdings = allHoldings.filter((holding) => holding.accountId === activeAccount.id);
  const cashBalance = await getAccountCash(userId, activeAccount.id);
  const marketValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0);
  const unrealizedPnl = holdings.reduce((sum, holding) => sum + holding.unrealizedPnl, 0);

  return {
    accounts,
    activeAccount,
    holdings,
    orders: transactions.filter((transaction) => ['buy', 'sell'].includes(transaction.type)),
    summary: {
      cashBalance,
      marketValue,
      totalValue: cashBalance + marketValue,
      unrealizedPnl,
      positionsCount: holdings.length
    }
  };
}

export async function switchPaperAccount(userId: string, accountId: string) {
  const account = await prisma.account.findFirstOrThrow({ where: { id: accountId, userId } });
  if (account.accountType === 'paper') {
    await ensurePaperFunding(userId, account.id, account.currency);
  }
  return account;
}

export async function submitPaperOrder(input: {
  userId: string;
  accountId: string;
  side: 'buy' | 'sell';
  symbol: string;
  quantity: number;
  price: number;
  fee: number;
}) {
  const account = await prisma.account.findFirstOrThrow({
    where: { id: input.accountId, userId: input.userId }
  });

  if (account.accountType !== 'paper') {
    throw new Error('Only paper accounts can submit sandbox orders.');
  }

  if (input.quantity <= 0 || input.price <= 0 || input.fee < 0) {
    throw new Error('Quantity and price must be positive.');
  }

  await ensurePaperFunding(input.userId, account.id, account.currency);

  const symbol = input.symbol.trim().toUpperCase();
  const asset = await findOrCreateAsset(symbol, {
    name: symbol,
    currency: account.currency,
    latestPrice: input.price
  });

  const cash = await getAccountCash(input.userId, account.id);
  const notional = input.quantity * input.price;

  if (input.side === 'buy' && cash < notional + input.fee) {
    throw new Error('Insufficient paper cash for this sandbox order.');
  }

  if (input.side === 'sell') {
    const holdings = await getHoldings(input.userId);
    const holding = holdings.find((row) => row.accountId === account.id && row.symbol === symbol);
    if (!holding || holding.quantity + 1e-9 < input.quantity) {
      throw new Error('Insufficient paper position to sell.');
    }
  }

  await prisma.asset.update({
    where: { id: asset.id },
    data: { latestPrice: input.price }
  });

  return createTransaction({
    userId: input.userId,
    accountId: account.id,
    assetId: asset.id,
    type: input.side,
    tradeDate: new Date(),
    quantity: input.quantity,
    price: input.price,
    fee: input.fee,
    currency: account.currency,
    notes: `Paper ${input.side} order filled immediately`
  });
}

async function ensurePaperFunding(userId: string, accountId: string, currency: string) {
  const hasDeposit = await prisma.transaction.findFirst({
    where: {
      userId,
      accountId,
      type: 'deposit',
      notes: 'Initial paper cash'
    }
  });

  if (!hasDeposit) {
    await createTransaction({
      userId,
      accountId,
      assetId: null,
      type: 'deposit',
      tradeDate: new Date(),
      quantity: 0,
      price: STARTING_PAPER_CASH,
      fee: 0,
      currency,
      notes: 'Initial paper cash'
    });
  }
}

async function getAccountCash(userId: string, accountId: string) {
  const transactions = await prisma.transaction.findMany({ where: { userId, accountId } });

  return transactions.reduce((cash, transaction) => {
    if (transaction.type === 'deposit') return cash + transaction.price;
    if (transaction.type === 'withdrawal') return cash - transaction.price - transaction.fee;
    if (transaction.type === 'buy') return cash - transaction.quantity * transaction.price - transaction.fee;
    if (transaction.type === 'sell') return cash + transaction.quantity * transaction.price - transaction.fee;
    if (transaction.type === 'dividend') return cash + transaction.quantity * transaction.price - transaction.fee;
    if (transaction.type === 'fee') return cash - transaction.fee - transaction.price;
    return cash;
  }, 0);
}
