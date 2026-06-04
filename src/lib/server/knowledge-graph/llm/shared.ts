import type {
  CompanyEdgeDraft,
  EdgeClassificationInput,
  SemanticEdgeType,
} from '../types';
import { SEMANTIC_TYPES } from '../types';

/** Validate + filter raw model output into clean CompanyEdgeDraft[].
 * Drops unknown tickers, invalid types, and out-of-range confidences so a
 * hallucinating model can never inject a bad edge into the graph. */
export function sanitizeDrafts(raw: unknown, input: EdgeClassificationInput): CompanyEdgeDraft[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(input.companies.map((c) => c.ticker));
  const out: CompanyEdgeDraft[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const d = r as Record<string, unknown>;
    const sourceTicker = String(d.sourceTicker ?? '');
    const targetTicker = String(d.targetTicker ?? '');
    const type = d.type as SemanticEdgeType;
    const confidence = Number(d.confidence);
    if (!known.has(sourceTicker) || !known.has(targetTicker)) continue;
    if (sourceTicker === targetTicker) continue;
    if (!SEMANTIC_TYPES.includes(type)) continue;
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) continue;
    out.push({ sourceTicker, targetTicker, type, confidence });
  }
  return out;
}

export function buildClassificationPrompt(input: EdgeClassificationInput): string {
  const companies = input.companies
    .map((c) => `- ${c.ticker} (${c.name}${c.sector ? `, ${c.sector}` : ''})`)
    .join('\n');
  const pairs = input.candidatePairs
    .map((p) => `- ${p.sourceTicker} ↔ ${p.targetTicker}`)
    .join('\n');
  return [
    'You classify business relationships between public companies for an educational portfolio tool.',
    'For EACH candidate pair below, decide whether the relationship is competitor, supplier, or customer.',
    'If no clear relationship of those three exists, omit that pair entirely.',
    'Set confidence between 0 and 1. NEVER use a ticker that is not in the company list.',
    '',
    'Companies:',
    companies,
    '',
    'Candidate pairs:',
    pairs,
  ].join('\n');
}
