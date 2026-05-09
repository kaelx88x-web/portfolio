import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'demo@portfolio-ai.local' },
    update: {},
    create: {
      name: 'Demo Investor',
      email: 'demo@portfolio-ai.local',
      passwordHash: 'local-demo-only',
      baseCurrency: 'USD'
    }
  });

  const [moomoo, cash] = await Promise.all([
    prisma.account.upsert({
      where: { id: 'seed-account-moomoo' },
      update: {},
      create: {
        id: 'seed-account-moomoo',
        userId: user.id,
        name: 'Moomoo US Account',
        brokerName: 'Moomoo',
        accountType: 'brokerage',
        currency: 'USD'
      }
    }),
    prisma.account.upsert({
      where: { id: 'seed-account-cash' },
      update: {},
      create: {
        id: 'seed-account-cash',
        userId: user.id,
        name: 'Manual Cash Account',
        brokerName: 'Manual',
        accountType: 'cash',
        currency: 'USD'
      }
    })
  ]);

  const assets = await Promise.all([
    prisma.asset.upsert({
      where: { symbol: 'AAPL' },
      update: { latestPrice: 214.4 },
      create: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        assetType: 'stock',
        exchange: 'NASDAQ',
        currency: 'USD',
        sector: 'Technology',
        country: 'US',
        latestPrice: 214.4
      }
    }),
    prisma.asset.upsert({
      where: { symbol: 'VOO' },
      update: { latestPrice: 501.1 },
      create: {
        symbol: 'VOO',
        name: 'Vanguard S&P 500 ETF',
        assetType: 'etf',
        exchange: 'NYSEARCA',
        currency: 'USD',
        sector: 'Broad Market',
        country: 'US',
        latestPrice: 501.1
      }
    }),
    prisma.asset.upsert({
      where: { symbol: 'BTC-USD' },
      update: { latestPrice: 64000 },
      create: {
        symbol: 'BTC-USD',
        name: 'Bitcoin',
        assetType: 'crypto',
        exchange: 'Crypto',
        currency: 'USD',
        sector: 'Digital Asset',
        country: 'Global',
        latestPrice: 64000
      }
    })
  ]);

  const txCount = await prisma.transaction.count({ where: { userId: user.id } });
  if (txCount === 0) {
    await prisma.transaction.createMany({
      data: [
        {
          userId: user.id,
          accountId: cash.id,
          type: 'deposit',
          tradeDate: new Date('2026-01-05'),
          quantity: 0,
          price: 25000,
          fee: 0,
          currency: 'USD',
          notes: 'Initial capital'
        },
        {
          userId: user.id,
          accountId: moomoo.id,
          assetId: assets[0].id,
          type: 'buy',
          tradeDate: new Date('2026-01-12'),
          quantity: 25,
          price: 186.5,
          fee: 1,
          currency: 'USD'
        },
        {
          userId: user.id,
          accountId: moomoo.id,
          assetId: assets[1].id,
          type: 'buy',
          tradeDate: new Date('2026-02-03'),
          quantity: 12,
          price: 471.2,
          fee: 1.5,
          currency: 'USD'
        },
        {
          userId: user.id,
          accountId: moomoo.id,
          assetId: assets[0].id,
          type: 'sell',
          tradeDate: new Date('2026-03-20'),
          quantity: 5,
          price: 202.1,
          fee: 1,
          currency: 'USD',
          notes: 'Trim position'
        },
        {
          userId: user.id,
          accountId: moomoo.id,
          assetId: assets[0].id,
          type: 'dividend',
          tradeDate: new Date('2026-04-10'),
          quantity: 20,
          price: 0.24,
          fee: 0,
          currency: 'USD'
        }
      ]
    });
  }

  const defaultWatchlist = await prisma.watchlist.upsert({
    where: { id: 'seed-watchlist-main' },
    update: {},
    create: {
      id: 'seed-watchlist-main',
      userId: user.id,
      name: 'Main Watchlist'
    }
  });

  await prisma.watchlistItem.upsert({
    where: {
      watchlistId_assetId: {
        watchlistId: defaultWatchlist.id,
        assetId: assets[2].id
      }
    },
    update: {},
    create: {
      watchlistId: defaultWatchlist.id,
      assetId: assets[2].id,
      notes: 'Track for future crypto allocation'
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
