import { describe, it, expect } from 'vitest';
import { generateStructuralEdges, candidatePairsFromEdges } from './structural-edges';
import type { PlateMembership } from './types';

const members: PlateMembership[] = [
  { ticker: 'US.NVDA', name: 'NVIDIA', sector: 'Semis', market: 'US',
    plates: [
      { plate_code: 'US.IND.SEMI', plate_name: 'Semiconductors', plate_type: 'INDUSTRY' },
      { plate_code: 'US.CON.AI', plate_name: 'AI', plate_type: 'CONCEPT' },
    ] },
  { ticker: 'US.AMD', name: 'AMD', sector: 'Semis', market: 'US',
    plates: [
      { plate_code: 'US.IND.SEMI', plate_name: 'Semiconductors', plate_type: 'INDUSTRY' },
      { plate_code: 'US.CON.AI', plate_name: 'AI', plate_type: 'CONCEPT' },
    ] },
  { ticker: 'US.KO', name: 'Coca-Cola', sector: 'Beverages', market: 'US',
    plates: [{ plate_code: 'US.IND.BEV', plate_name: 'Beverages', plate_type: 'INDUSTRY' }] },
];

describe('generateStructuralEdges', () => {
  it('creates same_sector + same_concept edges for shared plates', () => {
    const edges = generateStructuralEdges(members, {});
    const pair = edges.filter(
      (e) => e.sourceTicker === 'US.AMD' && e.targetTicker === 'US.NVDA'
    );
    expect(pair.map((e) => e.type).sort()).toEqual(['same_concept', 'same_sector']);
  });

  it('orders endpoints deterministically (lexical) and dedupes', () => {
    const edges = generateStructuralEdges(members, {});
    // No edge should be NVDA->AMD; the canonical direction is AMD->NVDA.
    expect(edges.some((e) => e.sourceTicker === 'US.NVDA' && e.targetTicker === 'US.AMD')).toBe(false);
  });

  it('marks structural edges with confidence=null and grounds them on plate_code', () => {
    const sector = generateStructuralEdges(members, {}).find((e) => e.type === 'same_sector')!;
    expect(sector.confidence).toBeNull();
    expect(sector.groundedSource).toContain('US.IND.SEMI');
    expect(sector.weight).toBe(1);
  });

  it('does not connect companies with no shared plate', () => {
    const edges = generateStructuralEdges(members, {});
    expect(edges.some((e) => e.sourceTicker === 'US.KO' || e.targetTicker === 'US.KO')).toBe(false);
  });

  it('creates co_owned_by from overlapping holders with weight=overlap count', () => {
    const holders = { 'US.NVDA': ['Vanguard', 'BlackRock'], 'US.AMD': ['Vanguard', 'StateStreet'] };
    const edges = generateStructuralEdges(members, holders);
    const co = edges.find((e) => e.type === 'co_owned_by')!;
    expect(co.weight).toBe(1);
    expect(co.groundedSource).toBe('shared_holder:Vanguard');
  });
});

describe('candidatePairsFromEdges', () => {
  it('returns unique co-plate pairs only (no semantic, no co_owned_by)', () => {
    const edges = generateStructuralEdges(members, {});
    const pairs = candidatePairsFromEdges(edges);
    expect(pairs).toEqual([{ sourceTicker: 'US.AMD', targetTicker: 'US.NVDA' }]);
  });
});
