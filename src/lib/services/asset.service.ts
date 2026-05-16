import { prisma } from '$lib/server/db';
import type { BrokerHolding } from '$lib/types/portfolio';

export async function listAssets(search?: string | null) {
  return prisma.asset.findMany({
    where: search
      ? {
          OR: [
            { symbol: { contains: search } },
            { name: { contains: search } },
            { assetType: { contains: search } }
          ]
        }
      : undefined,
    orderBy: { symbol: 'asc' }
  });
}

export async function createAsset(input: {
  symbol: string;
  name: string;
  assetType: string;
  exchange: string | null;
  currency: string;
  sector: string | null;
  country: string | null;
  latestPrice: number;
}) {
  return prisma.asset.create({
    data: {
      ...input,
      symbol: input.symbol.toUpperCase()
    }
  });
}

export async function updateAsset(
  assetId: string,
  input: {
    symbol: string;
    name: string;
    assetType: string;
    exchange: string | null;
    currency: string;
    sector: string | null;
    country: string | null;
    latestPrice: number;
  }
) {
  return prisma.asset.update({
    where: { id: assetId },
    data: {
      ...input,
      symbol: input.symbol.toUpperCase()
    }
  });
}

export async function deleteAsset(assetId: string) {
  return prisma.asset.delete({ where: { id: assetId } });
}

export async function findOrCreateAsset(symbol: string, defaults?: Partial<{ name: string; currency: string; latestPrice: number }>) {
  const normalized = symbol.trim().toUpperCase();

  return prisma.asset.upsert({
    where: { symbol: normalized },
    update: {
      ...(defaults?.latestPrice !== undefined ? { latestPrice: defaults.latestPrice } : {}),
      ...(defaults?.currency ? { currency: defaults.currency } : {})
    },
    create: {
      symbol: normalized,
      name: defaults?.name ?? normalized,
      assetType: normalized.includes('-USD') ? 'crypto' : 'stock',
      currency: defaults?.currency ?? 'USD',
      latestPrice: defaults?.latestPrice ?? 0
    }
  });
}

export async function upsertAssetsFromBrokerHoldings(holdings: BrokerHolding[]) {
  await Promise.all(
    holdings.map((holding) => {
      const symbol = holding.symbol.trim().toUpperCase();
      const exchange = symbol.includes('.') ? symbol.split('.')[0] : null;
      const name = holding.name?.trim() || symbol;

      return prisma.asset.upsert({
        where: { symbol },
        create: {
          symbol,
          name,
          assetType: holding.asset_type || 'stock',
          exchange,
          currency: holding.currency || 'USD',
          country: exchange === 'US' ? 'US' : null,
          latestPrice: holding.market_price
        },
        update: {
          name,
          assetType: holding.asset_type || 'stock',
          exchange,
          currency: holding.currency || 'USD',
          country: exchange === 'US' ? 'US' : null,
          latestPrice: holding.market_price
        }
      });
    })
  );
}
