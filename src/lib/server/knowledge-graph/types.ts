// Shared types for the company knowledge graph. The LLMProvider interface is the
// single seam both adapters implement so the pipeline never branches on provider.

export type PlateType = 'INDUSTRY' | 'CONCEPT';

export type Plate = { plate_code: string; plate_name: string; plate_type: PlateType };

export type PlateMembership = {
  ticker: string;            // moomoo code form, e.g. "US.NVDA"
  name: string;
  sector: string | null;
  market: string | null;
  plates: Plate[];
};

export type StructuralEdgeType = 'same_sector' | 'same_concept' | 'co_owned_by';
export type SemanticEdgeType = 'competitor' | 'supplier' | 'customer';
export type EdgeType = StructuralEdgeType | SemanticEdgeType;

export type GraphEdge = {
  sourceTicker: string;
  targetTicker: string;
  type: EdgeType;
  weight: number;
  confidence: number | null;   // null = structural fact
  groundedSource: string | null;
};

// ---- LLM seam ----

export type EdgeClassificationInput = {
  companies: { ticker: string; name: string; sector: string | null }[];
  candidatePairs: { sourceTicker: string; targetTicker: string }[];
};

export type CompanyEdgeDraft = {
  sourceTicker: string;
  targetTicker: string;
  type: SemanticEdgeType;
  confidence: number; // 0–1
};

export interface LLMProvider {
  readonly name: 'claude' | 'gemini';
  classifyEdges(input: EdgeClassificationInput): Promise<CompanyEdgeDraft[]>;
}

export const SEMANTIC_TYPES: readonly SemanticEdgeType[] = ['competitor', 'supplier', 'customer'];
