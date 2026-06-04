# portfolioAI Knowledge Graph — Design

**Date:** 2026-06-04
**Status:** Approved (design); pending implementation plan
**Disclaimer carried by all AI-facing output:** *Untuk tujuan pendidikan sahaja — bukan nasihat kewangan*

## Goal

Map relationships between the user's portfolio positions (e.g. NVDA, AMD, TSM, AVGO, MSFT) and render them as an interactive graph. Two layers:

- **Factual layer (Moomoo)** — structural edges derived directly from Moomoo plate/holdings data. No AI.
- **Semantic layer (LLM)** — a pluggable LLM (Claude or Gemini) classifies relationships as competitor / supplier / customer, each edge grounded back to a source.

## Design decisions (resolved)

| Decision | Choice | Rationale |
|---|---|---|
| Redis cache + rate-limit location | **Node/SvelteKit layer** | FastAPI bridge is stateless today; caching/chunking already lives Node-side (`redis.ts`, `quote-cache.ts`, `sectors/refresh`). Keep the bridge a thin OpenD proxy. |
| `co_owned_by` edges | **Best-effort** | moomoo OpenD has no clean institutional-holders endpoint. Attempt the call; yield zero edges (not an error) when data is absent. Enum value kept so it can be enriched later without migration. |
| LLM client style | **Raw `fetch`, both providers** | Matches every existing AI service in the repo (raw `/v1/messages`). Zero new heavy deps. Identical output shape behind one interface. |
| UI placement | **New `/knowledge-graph` route** | Dedicated page + `POST /api/knowledge-graph/refresh`, mirroring `sectors/refresh` + `portfolioai` page patterns. |

## Architecture & data flow

The FastAPI bridge stays thin and stateless. Everything stateful (cache, edge generation, LLM, persistence) lives in the Node/SvelteKit layer, matching the existing `sectors/refresh` pattern.

```
positions (portfolioSnapshot.holdingsJson)
   → bridge: GET /quotes/plate-membership      (full plates: code + name + type)
   → bridge: GET /quotes/institutional-holders (best-effort)
   → Node: Redis cache (24h) keyed per ticker
   → Node: structural edge generation (deterministic, confidence = null)
   → Node: LLMProvider.classifyEdges()  (claude | gemini; confidence + groundedSource)
   → Node: threshold filter (default 0.5)
   → Prisma: CompanyNode + CompanyEdge (idempotent upsert)
   → SvelteKit load → ECharts `graph` series (interactive render)
```

## Components

### 1. Prisma — two new models only

No existing model is altered. The two new models reference each other; back-relations are added on `CompanyNode` only.

```prisma
model CompanyNode {
  id        String        @id @default(cuid())
  ticker    String        @unique
  name      String
  sector    String?
  market    String?
  outEdges  CompanyEdge[] @relation("edge_source")
  inEdges   CompanyEdge[] @relation("edge_target")
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
}

enum CompanyEdgeType {
  same_sector
  same_concept
  co_owned_by
  competitor
  supplier
  customer
}

model CompanyEdge {
  id             String          @id @default(cuid())
  sourceId       String
  targetId       String
  source         CompanyNode     @relation("edge_source", fields: [sourceId], references: [id])
  target         CompanyNode     @relation("edge_target", fields: [targetId], references: [id])
  type           CompanyEdgeType
  weight         Float           @default(1)
  confidence     Float?          // null = structural fact; populated for semantic edges
  groundedSource String?         // plate_code | "shared_holder:<name>" | url
  createdAt      DateTime        @default(now())

  @@index([sourceId, type])
}
```

Migration generated, non-destructive (additive `CREATE TABLE` / `CREATE INDEX` only).

### 2. Bridge endpoints (FastAPI, additive — port 8001)

- `GET /quotes/plate-membership?codes=` — returns **both** INDUSTRY and CONCEPT plates per code, each as `{ plate_code, plate_name, plate_type }`. New endpoint; existing `/quotes/owner-plate` left untouched (still consumed by `sectors/refresh`). Recursively splits a batch on error to skip unsupported codes (same technique as `owner-plate`). Respects moomoo limits: ≤200 codes per request, batched if more.
- `GET /quotes/institutional-holders?codes=` — **best-effort**: attempts the moomoo holdings call; returns `{ code, holders: [] }` with an `error` field when OpenD has no data (expected for most US tickers). Never raises on missing data.

### 3. Structural edge generation (Node, deterministic)

Pairwise over portfolio tickers:

- shared INDUSTRY plate → `same_sector`
- shared CONCEPT plate → `same_concept`
- overlapping institutional holders → `co_owned_by` (weight = overlap count)

`groundedSource` = the shared `plate_code` (or `shared_holder:<name>`). `confidence = null` (these are facts, not inferences). `weight` = number of shared plates/holders.

### 4. Pluggable LLM provider (raw fetch, one interface)

```ts
interface LLMProvider {
  classifyEdges(input: EdgeClassificationInput): Promise<CompanyEdgeDraft[]>;
}

type EdgeClassificationInput = {
  companies: { ticker: string; name: string; sector: string | null }[];
  candidatePairs: { sourceTicker: string; targetTicker: string }[]; // co-plate pairs
};

type CompanyEdgeDraft = {
  sourceTicker: string;
  targetTicker: string;
  type: 'competitor' | 'supplier' | 'customer';
  confidence: number; // 0–1
};
```

- **ClaudeAdapter** — `POST https://api.anthropic.com/v1/messages` with a single `tool_use` tool whose `input_schema` is the `CompanyEdgeDraft[]` shape, forcing valid JSON. Model: `claude-haiku-4-5-20251001` (overridable via `KG_CLAUDE_MODEL`).
- **GeminiAdapter** — `POST https://generativelanguage.googleapis.com/.../:generateContent` with `responseMimeType: "application/json"` + a **flat** `responseSchema`. Model: `gemini-flash-lite-latest` (overridable via `KG_GEMINI_MODEL`).

Both adapters return the identical `CompanyEdgeDraft[]` shape so the pipeline never branches on provider. Selection via `LLM_PROVIDER=claude|gemini`. Keys: `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` (never hardcoded). Prompt passes only the co-plate companies + candidate pairs and instructs the model to label each pair competitor/supplier/customer (or omit) with confidence 0–1, and to **never invent tickers** not in the input. Drafts referencing unknown tickers are discarded defensively.

### 5. Grounding + persistence

Semantic edges keep their LLM `confidence`; `groundedSource` = the `plate_code` that put the pair together. Edges below `KG_CONFIDENCE_THRESHOLD` (default `0.5`) are dropped. Nodes + edges are upserted via Prisma. A refresh deletes prior `CompanyEdge` rows for the portfolio's nodes before reinsert, so reruns are idempotent.

### 6. UI

- `POST /api/knowledge-graph/refresh` — runs the full pipeline (mirrors `sectors/refresh`; auth-gated via `locals.user`).
- `/knowledge-graph` route with a `load` returning `{ nodes, edges }` → an ECharts **`graph`** series component (force layout), lazy-imported and themed via `getChartTheme()` + CSS vars like existing charts. Structural edges rendered solid/muted; semantic edges colored by type (competitor / supplier / customer); edge width ∝ `weight`. Clicking a node focuses its neighbourhood. The disclaimer *"Untuk tujuan pendidikan sahaja — bukan nasihat kewangan"* is shown in the UI.

## Error handling

- Bridge endpoints skip unsupported codes by recursive batch-splitting; never fail the whole request for one bad code.
- `institutional-holders` returns empty + `error` field rather than raising.
- Node pipeline: a failed bridge chunk is skipped (rest proceed), matching `sectors/refresh`.
- LLM call failure → semantic layer yields no edges; structural edges still persist and render (graceful degradation).
- Redis miss → fetch from bridge and backfill cache; Redis unavailable → proceed without cache (best-effort).

## Testing

- **Vitest** — each adapter against a mocked `fetch` response asserting `CompanyEdgeDraft[]` schema conformance and identical cross-provider shape; structural edge generation from a fixed plate/holdings fixture.
- **Pytest** — `/quotes/plate-membership` with a mocked OpenD client asserting batching (≤200/req) and split-on-error handling, in the style of `moomoo-service/tests/test_options.py`.

## Acceptance criteria

- [ ] `LLM_PROVIDER=claude` and `LLM_PROVIDER=gemini` produce the same `CompanyEdge` shape for the same input.
- [ ] Running the pipeline on the demo portfolio populates `CompanyNode` + `CompanyEdge` and the graph renders.
- [ ] Plate data is cached in Redis; a second run makes no redundant Moomoo calls.
- [ ] No existing model or migration is altered.
- [ ] Structural edges have `confidence = null`; semantic edges have populated `confidence` and `groundedSource`.

## Out of scope (v1)

- Reliable `co_owned_by` edges (best-effort only until a holdings data source exists).
- Web-grounded citations (URL `groundedSource`); plate-code grounding only for now.
- Multi-currency / non-US plate coverage beyond what owner-plate already returns.
