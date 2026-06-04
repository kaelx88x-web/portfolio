import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(302, '/login');

  // Build the user's node set from latest snapshots, then read persisted graph.
  const snaps = await prisma.portfolioSnapshot.findMany({
    where: { userId: locals.user.id },
    orderBy: { snapshotDate: 'desc' },
    distinct: ['brokerAccId'],
    select: { holdingsJson: true },
  });
  const heldTickers = new Set<string>();
  for (const snap of snaps) {
    let rows: Array<{ symbol?: string }> = [];
    try { rows = JSON.parse(snap.holdingsJson); } catch { rows = []; }
    for (const h of rows) {
      const sym = (h.symbol ?? '').trim().toUpperCase();
      if (sym) heldTickers.add(sym);
    }
  }

  const nodes = await prisma.companyNode.findMany({
    include: { outEdges: true },
  });
  // Only surface nodes that participate in this user's portfolio graph.
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const edges = nodes
    .flatMap((n) => n.outEdges)
    .map((e) => ({
      source: nodeById.get(e.sourceId)?.ticker ?? '',
      target: nodeById.get(e.targetId)?.ticker ?? '',
      type: e.type,
      weight: e.weight,
      confidence: e.confidence,
      groundedSource: e.groundedSource,
    }))
    .filter((e) => e.source && e.target);

  const connected = new Set(edges.flatMap((e) => [e.source, e.target]));
  const viewNodes = nodes
    .filter((n) => connected.has(n.ticker))
    .map((n) => ({ ticker: n.ticker, name: n.name, sector: n.sector, market: n.market }));

  return {
    nodes: viewNodes,
    edges,
    hasPositions: heldTickers.size > 0,
  };
};
