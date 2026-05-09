import { prisma } from '$lib/server/db';

export async function listWatchlists(userId: string) {
  return prisma.watchlist.findMany({
    where: { userId },
    include: {
      items: {
        include: { asset: true },
        orderBy: { createdAt: 'desc' }
      }
    },
    orderBy: { createdAt: 'asc' }
  });
}

export async function createWatchlist(userId: string, name: string) {
  return prisma.watchlist.create({ data: { userId, name } });
}

export async function deleteWatchlist(userId: string, watchlistId: string) {
  return prisma.watchlist.delete({ where: { id_userId: { id: watchlistId, userId } } });
}

export async function addWatchlistItem(watchlistId: string, assetId: string, notes: string | null) {
  return prisma.watchlistItem.upsert({
    where: {
      watchlistId_assetId: {
        watchlistId,
        assetId
      }
    },
    update: { notes },
    create: {
      watchlistId,
      assetId,
      notes
    }
  });
}

export async function removeWatchlistItem(itemId: string) {
  return prisma.watchlistItem.delete({ where: { id: itemId } });
}
