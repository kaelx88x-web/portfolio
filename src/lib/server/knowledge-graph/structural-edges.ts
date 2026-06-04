import type { GraphEdge, PlateMembership, Plate } from './types';

/** Canonical endpoint order so each unordered pair yields exactly one edge per type. */
function order(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function sharedPlates(a: Plate[], b: Plate[], type: Plate['plate_type']): string[] {
  const bCodes = new Set(b.filter((p) => p.plate_type === type).map((p) => p.plate_code));
  return a.filter((p) => p.plate_type === type && bCodes.has(p.plate_code)).map((p) => p.plate_code);
}

function overlap(a: string[] = [], b: string[] = []): string[] {
  const bset = new Set(b);
  return a.filter((x) => bset.has(x));
}

/**
 * Deterministic structural edges: same_sector (shared INDUSTRY plate), same_concept
 * (shared CONCEPT plate), co_owned_by (overlapping institutional holders). All carry
 * confidence=null (facts) and are grounded on the shared plate_code / holder name.
 */
export function generateStructuralEdges(
  members: PlateMembership[],
  holdersByTicker: Record<string, string[]>
): GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i];
      const b = members[j];
      const [src, tgt] = order(a.ticker, b.ticker);

      const ind = sharedPlates(a.plates, b.plates, 'INDUSTRY');
      if (ind.length) {
        edges.push({ sourceTicker: src, targetTicker: tgt, type: 'same_sector',
          weight: ind.length, confidence: null, groundedSource: ind.join(',') });
      }

      const con = sharedPlates(a.plates, b.plates, 'CONCEPT');
      if (con.length) {
        edges.push({ sourceTicker: src, targetTicker: tgt, type: 'same_concept',
          weight: con.length, confidence: null, groundedSource: con.join(',') });
      }

      const shared = overlap(holdersByTicker[a.ticker], holdersByTicker[b.ticker]);
      if (shared.length) {
        edges.push({ sourceTicker: src, targetTicker: tgt, type: 'co_owned_by',
          weight: shared.length, confidence: null, groundedSource: `shared_holder:${shared.join(',')}` });
      }
    }
  }

  return edges;
}

/** Unique co-plate pairs (same_sector/same_concept) to feed the LLM semantic layer. */
export function candidatePairsFromEdges(
  edges: GraphEdge[]
): { sourceTicker: string; targetTicker: string }[] {
  const seen = new Set<string>();
  const out: { sourceTicker: string; targetTicker: string }[] = [];
  for (const e of edges) {
    if (e.type !== 'same_sector' && e.type !== 'same_concept') continue;
    const key = `${e.sourceTicker}|${e.targetTicker}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ sourceTicker: e.sourceTicker, targetTicker: e.targetTicker });
  }
  return out;
}
