import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { toMoomooCode, isOption } from '$lib/server/knowledge-graph/ticker';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(302, '/login');

  // The user's held tickers in moomoo code form — the same canonicalization the
  // pipeline persists under, so node scoping matches.
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
      const sym = (h.symbol ?? '').trim();
      if (!sym || isOption(sym)) continue;
      heldTickers.add(toMoomooCode(sym));
    }
  }

  const heldCodes = [...heldTickers];
  if (heldCodes.length === 0) {
    return { nodes: [], edges: [], hasPositions: false };
  }

  // Only this user's held companies, and only edges whose BOTH endpoints are held.
  const nodes = await prisma.companyNode.findMany({
    where: { ticker: { in: heldCodes } },
    include: { outEdges: true },
  });
  const heldIds = new Set(nodes.map((n) => n.id));
  const tickerById = new Map(nodes.map((n) => [n.id, n.ticker]));

  const edges = nodes
    .flatMap((n) => n.outEdges)
    .filter((e) => heldIds.has(e.sourceId) && heldIds.has(e.targetId))
    .map((e) => ({
      source: tickerById.get(e.sourceId) ?? '',
      target: tickerById.get(e.targetId) ?? '',
      type: e.type,
      weight: e.weight,
      confidence: e.confidence,
      groundedSource: e.groundedSource,
    }))
    .filter((e) => e.source && e.target);

  // Show ALL held companies, including ones with no mapped relationships (isolated nodes).
  const viewNodes = nodes.map((n) => ({
    ticker: n.ticker, name: n.name, sector: n.sector, market: n.market,
  }));

  return { nodes: viewNodes, edges, hasPositions: true };
};
