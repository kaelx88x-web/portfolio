import { env } from '$env/dynamic/private';
import { prisma } from '$lib/server/db';
import type { GraphEdge, PlateMembership } from './types';
import { getPlateMembership, getInstitutionalHolders } from './plate-source';
import { generateStructuralEdges, candidatePairsFromEdges } from './structural-edges';
import { getLLMProvider } from './llm';
import { toMoomooCode, isOption } from './ticker';

/** Read the user's distinct held tickers (moomoo code form) from latest snapshots. */
async function getPortfolioTickers(userId: string): Promise<Map<string, string>> {
  const snaps = await prisma.portfolioSnapshot.findMany({
    where: { userId },
    orderBy: { snapshotDate: 'desc' },
    distinct: ['brokerAccId'],
    select: { holdingsJson: true },
  });
  const tickerToName = new Map<string, string>();
  for (const snap of snaps) {
    let rows: Array<{ symbol?: string; name?: string }> = [];
    try { rows = JSON.parse(snap.holdingsJson); } catch { rows = []; }
    for (const h of rows) {
      const sym = (h.symbol ?? '').trim();
      if (!sym || isOption(sym)) continue;
      const code = toMoomooCode(sym);
      if (!tickerToName.has(code)) tickerToName.set(code, h.name ?? code);
    }
  }
  return tickerToName;
}

export type PipelineResult = { tickers: number; nodes: number; edges: number; provider: string | null };

/**
 * Full knowledge-graph build for a user: positions → plates+holders → structural
 * edges → LLM semantic edges (thresholded) → idempotent Prisma upsert.
 */
export async function runKnowledgeGraphPipeline(
  userId: string,
  opts: { force?: boolean } = {}
): Promise<PipelineResult> {
  const tickerToName = await getPortfolioTickers(userId);
  const tickers = [...tickerToName.keys()];
  if (tickers.length === 0) return { tickers: 0, nodes: 0, edges: 0, provider: null };

  const [platesByTicker, holdersByTicker] = await Promise.all([
    getPlateMembership(tickers, opts),
    getInstitutionalHolders(tickers, opts),
  ]);

  const members: PlateMembership[] = tickers.map((t) => ({
    ticker: t,
    name: tickerToName.get(t) ?? t,
    sector: platesByTicker[t]?.find((p) => p.plate_type === 'INDUSTRY')?.plate_name ?? null,
    market: t.split('.')[0] ?? null,
    plates: platesByTicker[t] ?? [],
  }));

  const structural = generateStructuralEdges(members, holdersByTicker);

  // Semantic layer (best-effort; graceful when no provider/key configured).
  const provider = getLLMProvider();
  const threshold = Number(env.KG_CONFIDENCE_THRESHOLD ?? 0.5);
  let semantic: GraphEdge[] = [];
  if (provider) {
    const candidatePairs = candidatePairsFromEdges(structural);
    const candidateKeys = new Set(
      candidatePairs.flatMap((p) => [
        `${p.sourceTicker}|${p.targetTicker}`,
        `${p.targetTicker}|${p.sourceTicker}`,
      ])
    );
    const drafts = await provider.classifyEdges({
      companies: members.map((m) => ({ ticker: m.ticker, name: m.name, sector: m.sector })),
      candidatePairs,
    });
    const groundingByPair = new Map(
      structural
        .filter((e) => e.type === 'same_sector' || e.type === 'same_concept')
        .map((e) => [`${e.sourceTicker}|${e.targetTicker}`, e.groundedSource])
    );
    semantic = drafts
      .filter((d) => d.confidence >= threshold && candidateKeys.has(`${d.sourceTicker}|${d.targetTicker}`))
      .map((d) => {
        const grounded =
          groundingByPair.get(`${d.sourceTicker}|${d.targetTicker}`) ??
          groundingByPair.get(`${d.targetTicker}|${d.sourceTicker}`) ??
          null;
        return {
          sourceTicker: d.sourceTicker,
          targetTicker: d.targetTicker,
          type: d.type,
          weight: 1,
          confidence: d.confidence,
          groundedSource: grounded,
        };
      });
  }

  const allEdges = [...structural, ...semantic];
  await persistGraph(members, allEdges);
  return { tickers: tickers.length, nodes: members.length, edges: allEdges.length, provider: provider?.name ?? null };
}

/** Upsert nodes, then replace this portfolio's edges (idempotent reruns). */
async function persistGraph(members: PlateMembership[], edges: GraphEdge[]): Promise<void> {
  const idByTicker = new Map<string, string>();
  for (const m of members) {
    const node = await prisma.companyNode.upsert({
      where: { ticker: m.ticker },
      create: { ticker: m.ticker, name: m.name, sector: m.sector, market: m.market },
      update: { name: m.name, sector: m.sector, market: m.market },
    });
    idByTicker.set(m.ticker, node.id);
  }

  const nodeIds = [...idByTicker.values()];
  // Replace prior edges originating from this portfolio's nodes so reruns don't duplicate.
  await prisma.companyEdge.deleteMany({ where: { sourceId: { in: nodeIds } } });

  const rows = edges
    .map((e) => {
      const sourceId = idByTicker.get(e.sourceTicker);
      const targetId = idByTicker.get(e.targetTicker);
      if (!sourceId || !targetId) return null;
      return {
        sourceId,
        targetId,
        type: e.type,
        weight: e.weight,
        confidence: e.confidence,
        groundedSource: e.groundedSource,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length) await prisma.companyEdge.createMany({ data: rows });
}
