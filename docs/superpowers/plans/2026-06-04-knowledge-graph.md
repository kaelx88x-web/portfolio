# Company Knowledge Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a provider-agnostic company knowledge graph that maps relationships between the user's portfolio positions (structural facts from Moomoo + semantic competitor/supplier/customer edges from a pluggable LLM) and renders them as an interactive ECharts graph.

**Architecture:** The FastAPI bridge (`moomoo-service`, port 8001) stays a thin, stateless OpenD proxy — it gains two additive read endpoints. All stateful work (Redis caching, structural edge generation, LLM classification, Prisma persistence, rendering) lives in the Node/SvelteKit layer, mirroring the existing `sectors/refresh` pattern. The LLM is accessed through a single `LLMProvider` interface with raw-`fetch` Claude and Gemini adapters selected by `LLM_PROVIDER`.

**Tech Stack:** SvelteKit + TypeScript, Prisma (MySQL), ioredis, ECharts 6 (`graph` series), Python FastAPI + moomoo-api, Vitest, Pytest/unittest.

**Reference spec:** `docs/superpowers/specs/2026-06-04-knowledge-graph-design.md`

---

## File Structure

**Prisma**
- Modify: `prisma/schema.prisma` — add `CompanyNode`, `CompanyEdge`, `CompanyEdgeType` (no existing model touched)
- Create (generated): `prisma/migrations/<ts>_add_company_knowledge_graph/migration.sql`

**Python bridge**
- Create: `moomoo-service/plate_logic.py` — pure, OpenD-free helpers (batching, row grouping, split-on-error collect)
- Create: `moomoo-service/tests/test_plate_logic.py`
- Modify: `moomoo-service/main.py` — add `GET /quotes/plate-membership`, `GET /quotes/institutional-holders`

**Node — knowledge-graph server module** (`src/lib/server/knowledge-graph/`)
- Create: `types.ts` — shared types + the `LLMProvider` interface
- Create: `structural-edges.ts` — deterministic edge generation (pure)
- Create: `structural-edges.test.ts`
- Create: `plate-source.ts` — bridge fetch + Redis (24h) cache for plates & holders
- Create: `llm/claude-adapter.ts`
- Create: `llm/claude-adapter.test.ts`
- Create: `llm/gemini-adapter.ts`
- Create: `llm/gemini-adapter.test.ts`
- Create: `llm/index.ts` — `getLLMProvider()` factory
- Create: `pipeline.ts` — orchestrates positions → plates → edges → persist

**Node — routes & UI**
- Create: `src/routes/api/knowledge-graph/refresh/+server.ts` — `POST` pipeline trigger
- Create: `src/routes/knowledge-graph/+page.server.ts` — `load` returns `{ nodes, edges }`
- Create: `src/routes/knowledge-graph/+page.svelte` — page shell, refresh button, disclaimer
- Create: `src/lib/components/portfolioai/charts/KnowledgeGraphChart.svelte` — ECharts `graph` series

---

## Task 1: Prisma models + migration

**Files:**
- Modify: `prisma/schema.prisma` (append at end of file)

- [ ] **Step 1: Append the two new models + enum to the schema**

Add to the END of `prisma/schema.prisma` (do not edit any existing block):

```prisma
enum CompanyEdgeType {
  same_sector
  same_concept
  co_owned_by
  competitor
  supplier
  customer
}

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

model CompanyEdge {
  id             String          @id @default(cuid())
  sourceId       String
  targetId       String
  source         CompanyNode     @relation("edge_source", fields: [sourceId], references: [id])
  target         CompanyNode     @relation("edge_target", fields: [targetId], references: [id])
  type           CompanyEdgeType
  weight         Float           @default(1)
  confidence     Float?
  groundedSource String?
  createdAt      DateTime        @default(now())

  @@index([sourceId, type])
}
```

- [ ] **Step 2: Validate the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 3: Create + apply the migration (additive only)**

Run: `npx prisma migrate dev --name add_company_knowledge_graph`
Expected: a new folder `prisma/migrations/<ts>_add_company_knowledge_graph/` whose `migration.sql` contains only `CREATE TABLE CompanyNode`, `CREATE TABLE CompanyEdge`, `CREATE INDEX`, and the FK `ALTER TABLE` for the two new tables. **Verify the SQL contains no `DROP`/`ALTER` against any pre-existing table before continuing.**

- [ ] **Step 4: Regenerate the client**

Run: `npx prisma generate`
Expected: `Generated Prisma Client`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(knowledge-graph): add CompanyNode + CompanyEdge models"
```

---

## Task 2: Python plate logic (pure, OpenD-free)

**Files:**
- Create: `moomoo-service/plate_logic.py`
- Test: `moomoo-service/tests/test_plate_logic.py`

- [ ] **Step 1: Write the failing test**

Create `moomoo-service/tests/test_plate_logic.py`:

```python
"""Pure plate-membership logic for /quotes/plate-membership — no OpenD/SDK needed.

Run: python -m unittest moomoo-service/tests/test_plate_logic.py
Also runs under pytest if available.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from plate_logic import (  # noqa: E402
    chunk_codes,
    group_plate_membership,
    collect_plate_membership,
)


class TestChunkCodes(unittest.TestCase):
    def test_batches_respect_max_size(self):
        codes = [f"US.S{i}" for i in range(450)]
        chunks = chunk_codes(codes, 200)
        self.assertEqual([len(c) for c in chunks], [200, 200, 50])
        self.assertTrue(all(len(c) <= 200 for c in chunks))

    def test_empty_input(self):
        self.assertEqual(chunk_codes([], 200), [])


class TestGroupPlateMembership(unittest.TestCase):
    def test_keeps_only_industry_and_concept(self):
        rows = [
            {"code": "US.NVDA", "plate_code": "US.IND01", "plate_name": "Semis", "plate_type": "INDUSTRY"},
            {"code": "US.NVDA", "plate_code": "US.CON01", "plate_name": "AI", "plate_type": "CONCEPT"},
            {"code": "US.NVDA", "plate_code": "US.REG01", "plate_name": "USA", "plate_type": "REGION"},
        ]
        out = group_plate_membership(rows)
        self.assertEqual(len(out["US.NVDA"]), 2)
        self.assertEqual({p["plate_type"] for p in out["US.NVDA"]}, {"INDUSTRY", "CONCEPT"})

    def test_reads_plate_class_alias(self):
        rows = [{"code": "us.amd", "plate_code": "US.IND01", "plate_name": "Semis", "plate_class": "industry"}]
        out = group_plate_membership(rows)
        self.assertEqual(out["US.AMD"][0]["plate_code"], "US.IND01")
        self.assertEqual(out["US.AMD"][0]["plate_type"], "INDUSTRY")

    def test_skips_rows_without_code_or_plate(self):
        rows = [{"code": "", "plate_code": "X", "plate_type": "INDUSTRY"},
                {"code": "US.X", "plate_code": "", "plate_type": "INDUSTRY"}]
        self.assertEqual(group_plate_membership(rows), {})


class TestCollectPlateMembership(unittest.TestCase):
    def test_splits_batch_to_skip_unsupported_code(self):
        calls = []

        def fetch_fn(batch):
            calls.append(list(batch))
            if "US.BAD" in batch and len(batch) > 1:
                return (False, [])  # whole chunk fails while BAD is present
            if batch == ["US.BAD"]:
                return (False, [])  # single bad code -> skipped
            return (True, [{"code": c, "plate_code": "US.IND01", "plate_name": "Semis",
                            "plate_type": "INDUSTRY"} for c in batch])

        membership = collect_plate_membership(fetch_fn, ["US.NVDA", "US.BAD", "US.AMD"])
        self.assertIn("US.NVDA", membership)
        self.assertIn("US.AMD", membership)
        self.assertNotIn("US.BAD", membership)

    def test_never_requests_more_than_max_per_call(self):
        calls = []

        def fetch_fn(batch):
            calls.append(list(batch))
            return (True, [{"code": c, "plate_code": "US.IND01", "plate_name": "Semis",
                            "plate_type": "INDUSTRY"} for c in batch])

        codes = [f"US.S{i}" for i in range(250)]
        collect_plate_membership(fetch_fn, codes, max_per_req=200)
        self.assertTrue(all(len(c) <= 200 for c in calls))
        self.assertEqual(sum(len(c) for c in calls), 250)
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m unittest moomoo-service/tests/test_plate_logic.py`
Expected: FAIL — `ModuleNotFoundError: No module named 'plate_logic'`

- [ ] **Step 3: Write the implementation**

Create `moomoo-service/plate_logic.py`:

```python
"""Pure helpers for company plate membership (knowledge graph).

OpenD-free so they can be unit-tested without the moomoo SDK, matching the
options_logic / cashflow_logic pattern. The endpoint in main.py wires a real
OpenQuoteContext.get_owner_plate call into collect_plate_membership.
"""
from typing import Any, Callable

KEEP_TYPES = ("INDUSTRY", "CONCEPT")


def chunk_codes(codes: list[str], size: int = 200) -> list[list[str]]:
    return [codes[i:i + size] for i in range(0, len(codes), size)]


def _normalize_plate_row(row: dict[str, Any]) -> dict[str, str]:
    return {
        "stock_code": str(row.get("code") or "").upper(),
        "plate_code": str(row.get("plate_code") or ""),
        "plate_name": str(row.get("plate_name") or ""),
        "plate_type": str(row.get("plate_class") or row.get("plate_type") or "").upper(),
    }


def group_plate_membership(
    rows: list[dict[str, Any]], keep_types: tuple[str, ...] = KEEP_TYPES
) -> dict[str, list[dict[str, str]]]:
    """Group raw get_owner_plate rows into {stock_code: [{plate_code, plate_name, plate_type}]}."""
    out: dict[str, list[dict[str, str]]] = {}
    for row in rows:
        n = _normalize_plate_row(row)
        if n["plate_type"] not in keep_types:
            continue
        if not n["stock_code"] or not n["plate_code"]:
            continue
        out.setdefault(n["stock_code"], []).append(
            {"plate_code": n["plate_code"], "plate_name": n["plate_name"], "plate_type": n["plate_type"]}
        )
    return out


def collect_plate_membership(
    fetch_fn: Callable[[list[str]], tuple[bool, list[dict[str, Any]]]],
    codes: list[str],
    keep_types: tuple[str, ...] = KEEP_TYPES,
    max_per_req: int = 200,
) -> dict[str, list[dict[str, str]]]:
    """Collect plate membership, splitting a batch on failure to skip unsupported codes.

    fetch_fn(codes) -> (ok, rows). Respects max_per_req (moomoo: 200 stocks/request).
    """
    membership: dict[str, list[dict[str, str]]] = {}

    def _recurse(batch: list[str]) -> None:
        if not batch:
            return
        ok, rows = fetch_fn(batch)
        if ok:
            for code, plates in group_plate_membership(rows, keep_types).items():
                membership.setdefault(code, []).extend(plates)
        elif len(batch) == 1:
            return  # single unsupported code — skip silently
        else:
            mid = len(batch) // 2
            _recurse(batch[:mid])
            _recurse(batch[mid:])

    for chunk in chunk_codes(codes, max_per_req):
        _recurse(chunk)
    return membership
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m unittest moomoo-service/tests/test_plate_logic.py`
Expected: `OK` (7 tests)

- [ ] **Step 5: Commit**

```bash
git add moomoo-service/plate_logic.py moomoo-service/tests/test_plate_logic.py
git commit -m "feat(knowledge-graph): pure plate-membership logic + tests"
```

---

## Task 3: Python bridge endpoints

**Files:**
- Modify: `moomoo-service/main.py` (add two endpoints after the existing `/quotes/owner-plate` block, ~line 311)

- [ ] **Step 1: Add the `/quotes/plate-membership` endpoint**

Insert into `moomoo-service/main.py` immediately after the `quote_owner_plate` function (after its `return`, before `/quotes/capital-flow`):

```python
@app.get("/quotes/plate-membership")
def quote_plate_membership(codes: str):
    """Return INDUSTRY + CONCEPT plates each stock belongs to, with plate_code for grounding.

    Distinct from /quotes/owner-plate (which collapses to a single sector string):
    this returns the full plate list so the knowledge graph can build same_sector /
    same_concept edges and cite the shared plate_code.
    """
    all_codes = _parse_codes(codes)
    if not all_codes:
        raise HTTPException(status_code=400, detail="At least one code is required.")

    try:
        from moomoo import OpenQuoteContext, RET_OK
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    from plate_logic import collect_plate_membership

    candidate_codes = [c for c in all_codes if _asset_type(c) != "option"]
    ctx = None
    try:
        ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT, ai_type=1)

        def fetch_fn(batch: list[str]):
            ret, data = ctx.get_owner_plate(batch)
            if ret != RET_OK:
                return (False, [])
            return (True, _records(data))

        membership = collect_plate_membership(fetch_fn, candidate_codes)
    finally:
        if ctx is not None:
            ctx.close()

    results = [{"code": code, "plates": membership.get(code.upper(), [])} for code in all_codes]
    return {"count": len(results), "memberships": results}
```

- [ ] **Step 2: Add the `/quotes/institutional-holders` endpoint (best-effort)**

Insert directly after the function from Step 1:

```python
@app.get("/quotes/institutional-holders")
def quote_institutional_holders(codes: str):
    """Best-effort institutional holders per code for co_owned_by edges.

    moomoo OpenD has no general institutional-holders API, so this is defensive:
    it returns {code, holders: [], error} rather than raising when data is absent
    (expected for most US tickers).
    """
    code_list = _parse_codes(codes)
    if not code_list:
        raise HTTPException(status_code=400, detail="At least one code is required.")
    if len(code_list) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 codes per request.")

    try:
        from moomoo import OpenQuoteContext, RET_OK
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    results = []
    ctx = None
    try:
        ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT, ai_type=1)
        for code in code_list:
            holders: list[str] = []
            error: str | None = None
            try:
                fn = getattr(ctx, "get_holding_change_list", None)
                if fn is None:
                    error = "institutional holdings endpoint unavailable in this SDK"
                else:
                    from moomoo import StockHoldingChangeType
                    ret, data = fn(code, StockHoldingChangeType.INSTITUTE, "", "")
                    if ret == RET_OK:
                        holders = [
                            str(r.get("holder_name") or r.get("name") or "")
                            for r in _records(data)
                            if (r.get("holder_name") or r.get("name"))
                        ]
                    else:
                        error = str(data)
            except Exception as exc:  # noqa: BLE001 — best-effort, never fail the request
                error = str(exc)
            results.append({"code": code, "holders": holders, "error": error})
    finally:
        if ctx is not None:
            ctx.close()

    return {"count": len(results), "holdings": results}
```

- [ ] **Step 3: Verify the service imports cleanly**

Run: `python -c "import sys; sys.path.insert(0, 'moomoo-service'); import main; print('routes:', [r.path for r in main.app.routes if 'plate-membership' in r.path or 'institutional-holders' in r.path])"`
Expected: `routes: ['/quotes/plate-membership', '/quotes/institutional-holders']`

- [ ] **Step 4: Re-run the bridge test suite (no regressions)**

Run: `python -m unittest discover -s moomoo-service/tests`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add moomoo-service/main.py
git commit -m "feat(knowledge-graph): plate-membership + institutional-holders bridge endpoints"
```

---

## Task 4: Node shared types

**Files:**
- Create: `src/lib/server/knowledge-graph/types.ts`

- [ ] **Step 1: Write the types module**

Create `src/lib/server/knowledge-graph/types.ts`:

```ts
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors referencing `types.ts` (pre-existing unrelated errors, if any, are out of scope — confirm none mention `knowledge-graph`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/knowledge-graph/types.ts
git commit -m "feat(knowledge-graph): shared types + LLMProvider interface"
```

---

## Task 5: Structural edge generation (pure)

**Files:**
- Create: `src/lib/server/knowledge-graph/structural-edges.ts`
- Test: `src/lib/server/knowledge-graph/structural-edges.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/knowledge-graph/structural-edges.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/server/knowledge-graph/structural-edges.test.ts`
Expected: FAIL — cannot find module `./structural-edges`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/server/knowledge-graph/structural-edges.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/server/knowledge-graph/structural-edges.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/knowledge-graph/structural-edges.ts src/lib/server/knowledge-graph/structural-edges.test.ts
git commit -m "feat(knowledge-graph): deterministic structural edge generation + tests"
```

---

## Task 6: Plate source (bridge fetch + Redis cache)

**Files:**
- Create: `src/lib/server/knowledge-graph/plate-source.ts`

- [ ] **Step 1: Write the module**

Create `src/lib/server/knowledge-graph/plate-source.ts`:

```ts
import { env } from '$env/dynamic/private';
import { redisGet, redisSet } from '$lib/server/redis';
import type { Plate } from './types';

const PLATE_TTL = 60 * 60 * 24; // 24h — plates rarely change
const HOLDER_TTL = 60 * 60 * 24;
const CHUNK = 50;

function bridgeBase(): string {
  return env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Plate membership per ticker, Redis-cached (24h) per ticker so a second run makes
 * no redundant Moomoo calls. Cache misses are fetched from the bridge in chunks and
 * backfilled. Redis being unavailable degrades to a direct fetch (best-effort).
 */
export async function getPlateMembership(
  tickers: string[],
  opts: { force?: boolean } = {}
): Promise<Record<string, Plate[]>> {
  const result: Record<string, Plate[]> = {};
  const misses: string[] = [];

  for (const t of tickers) {
    if (!opts.force) {
      const hit = await safeGet(`kg:plates:${t}`);
      if (hit) { result[t] = JSON.parse(hit); continue; }
    }
    misses.push(t);
  }

  for (const group of chunk(misses, CHUNK)) {
    try {
      const res = await fetch(
        `${bridgeBase()}/quotes/plate-membership?codes=${encodeURIComponent(group.join(','))}`,
        { signal: AbortSignal.timeout(20000) }
      );
      if (!res.ok) continue;
      const body = await res.json();
      for (const m of body.memberships ?? []) {
        const code = String(m.code).toUpperCase();
        const plates: Plate[] = m.plates ?? [];
        result[code] = plates;
        await safeSet(`kg:plates:${code}`, JSON.stringify(plates), PLATE_TTL);
      }
    } catch {
      continue; // skip a bad chunk, keep the rest (matches sectors/refresh)
    }
  }

  for (const t of tickers) if (!result[t]) result[t] = [];
  return result;
}

/** Best-effort institutional holders per ticker, Redis-cached (24h). Empty on absence. */
export async function getInstitutionalHolders(
  tickers: string[],
  opts: { force?: boolean } = {}
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  const misses: string[] = [];

  for (const t of tickers) {
    if (!opts.force) {
      const hit = await safeGet(`kg:holders:${t}`);
      if (hit) { result[t] = JSON.parse(hit); continue; }
    }
    misses.push(t);
  }

  for (const group of chunk(misses, CHUNK)) {
    try {
      const res = await fetch(
        `${bridgeBase()}/quotes/institutional-holders?codes=${encodeURIComponent(group.join(','))}`,
        { signal: AbortSignal.timeout(20000) }
      );
      if (!res.ok) continue;
      const body = await res.json();
      for (const h of body.holdings ?? []) {
        const code = String(h.code).toUpperCase();
        const holders: string[] = h.holders ?? [];
        result[code] = holders;
        await safeSet(`kg:holders:${code}`, JSON.stringify(holders), HOLDER_TTL);
      }
    } catch {
      continue;
    }
  }

  for (const t of tickers) if (!result[t]) result[t] = [];
  return result;
}

async function safeGet(key: string): Promise<string | null> {
  try { return await redisGet(key); } catch { return null; }
}
async function safeSet(key: string, value: string, ttl: number): Promise<void> {
  try { await redisSet(key, value, ttl); } catch { /* cache best-effort */ }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors mentioning `plate-source.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/knowledge-graph/plate-source.ts
git commit -m "feat(knowledge-graph): Redis-cached plate + holder source from bridge"
```

---

## Task 7: Claude adapter

**Files:**
- Create: `src/lib/server/knowledge-graph/llm/claude-adapter.ts`
- Test: `src/lib/server/knowledge-graph/llm/claude-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/knowledge-graph/llm/claude-adapter.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeAdapter } from './claude-adapter';
import type { EdgeClassificationInput } from '../types';

const input: EdgeClassificationInput = {
  companies: [
    { ticker: 'US.NVDA', name: 'NVIDIA', sector: 'Semis' },
    { ticker: 'US.TSM', name: 'TSMC', sector: 'Semis' },
    { ticker: 'US.AMD', name: 'AMD', sector: 'Semis' },
  ],
  candidatePairs: [
    { sourceTicker: 'US.AMD', targetTicker: 'US.NVDA' },
    { sourceTicker: 'US.NVDA', targetTicker: 'US.TSM' },
  ],
};

function claudeToolResponse(edges: unknown) {
  return {
    ok: true,
    json: async () => ({
      content: [{ type: 'tool_use', name: 'emit_edges', input: { edges } }],
      usage: { input_tokens: 10, output_tokens: 20 },
    }),
  } as Response;
}

describe('ClaudeAdapter', () => {
  beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'test-key'; });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns CompanyEdgeDraft[] with the exact schema shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(claudeToolResponse([
      { sourceTicker: 'US.AMD', targetTicker: 'US.NVDA', type: 'competitor', confidence: 0.9 },
      { sourceTicker: 'US.NVDA', targetTicker: 'US.TSM', type: 'supplier', confidence: 0.8 },
    ])));

    const out = await new ClaudeAdapter().classifyEdges(input);
    expect(out).toEqual([
      { sourceTicker: 'US.AMD', targetTicker: 'US.NVDA', type: 'competitor', confidence: 0.9 },
      { sourceTicker: 'US.NVDA', targetTicker: 'US.TSM', type: 'supplier', confidence: 0.8 },
    ]);
  });

  it('drops drafts referencing tickers not in the input', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(claudeToolResponse([
      { sourceTicker: 'US.AMD', targetTicker: 'US.NVDA', type: 'competitor', confidence: 0.9 },
      { sourceTicker: 'US.FAKE', targetTicker: 'US.NVDA', type: 'customer', confidence: 0.7 },
    ])));
    const out = await new ClaudeAdapter().classifyEdges(input);
    expect(out).toHaveLength(1);
    expect(out[0].sourceTicker).toBe('US.AMD');
  });

  it('drops drafts with an invalid type or out-of-range confidence', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(claudeToolResponse([
      { sourceTicker: 'US.AMD', targetTicker: 'US.NVDA', type: 'frenemy', confidence: 0.9 },
      { sourceTicker: 'US.NVDA', targetTicker: 'US.TSM', type: 'supplier', confidence: 1.4 },
    ])));
    const out = await new ClaudeAdapter().classifyEdges(input);
    expect(out).toEqual([]);
  });

  it('returns [] when no candidate pairs are given (no network call)', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const out = await new ClaudeAdapter().classifyEdges({ companies: input.companies, candidatePairs: [] });
    expect(out).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it('returns [] (graceful) when the API call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response));
    const out = await new ClaudeAdapter().classifyEdges(input);
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/server/knowledge-graph/llm/claude-adapter.test.ts`
Expected: FAIL — cannot find module `./claude-adapter`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/server/knowledge-graph/llm/claude-adapter.ts`:

```ts
import type {
  CompanyEdgeDraft,
  EdgeClassificationInput,
  LLMProvider,
} from '../types';
import { sanitizeDrafts, buildClassificationPrompt } from './shared';

const EDGES_TOOL = {
  name: 'emit_edges',
  description: 'Return the classified directed relationships between the given companies.',
  input_schema: {
    type: 'object',
    properties: {
      edges: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sourceTicker: { type: 'string' },
            targetTicker: { type: 'string' },
            type: { type: 'string', enum: ['competitor', 'supplier', 'customer'] },
            confidence: { type: 'number' },
          },
          required: ['sourceTicker', 'targetTicker', 'type', 'confidence'],
        },
      },
    },
    required: ['edges'],
  },
} as const;

export class ClaudeAdapter implements LLMProvider {
  readonly name = 'claude' as const;

  async classifyEdges(input: EdgeClassificationInput): Promise<CompanyEdgeDraft[]> {
    if (input.candidatePairs.length === 0) return [];

    const model = process.env.KG_CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001';
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: Number(process.env.KG_MAX_TOKENS ?? 2000),
          tools: [EDGES_TOOL],
          tool_choice: { type: 'tool', name: 'emit_edges' },
          messages: [{ role: 'user', content: buildClassificationPrompt(input) }],
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) return [];
      const payload = await res.json();
      const block = (payload.content ?? []).find(
        (b: { type: string; name?: string }) => b.type === 'tool_use' && b.name === 'emit_edges'
      );
      const edges = block?.input?.edges ?? [];
      return sanitizeDrafts(edges, input);
    } catch {
      return []; // graceful: structural edges still render
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it fails on the missing `./shared` module**

Run: `npx vitest run src/lib/server/knowledge-graph/llm/claude-adapter.test.ts`
Expected: FAIL — cannot find module `./shared` (created in Step 5).

- [ ] **Step 5: Write the shared helpers**

Create `src/lib/server/knowledge-graph/llm/shared.ts`:

```ts
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
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/lib/server/knowledge-graph/llm/claude-adapter.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/knowledge-graph/llm/claude-adapter.ts src/lib/server/knowledge-graph/llm/shared.ts src/lib/server/knowledge-graph/llm/claude-adapter.test.ts
git commit -m "feat(knowledge-graph): Claude adapter (tool_use) + draft sanitizer + tests"
```

---

## Task 8: Gemini adapter

**Files:**
- Create: `src/lib/server/knowledge-graph/llm/gemini-adapter.ts`
- Test: `src/lib/server/knowledge-graph/llm/gemini-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/knowledge-graph/llm/gemini-adapter.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiAdapter } from './gemini-adapter';
import type { EdgeClassificationInput } from '../types';

const input: EdgeClassificationInput = {
  companies: [
    { ticker: 'US.NVDA', name: 'NVIDIA', sector: 'Semis' },
    { ticker: 'US.TSM', name: 'TSMC', sector: 'Semis' },
    { ticker: 'US.AMD', name: 'AMD', sector: 'Semis' },
  ],
  candidatePairs: [
    { sourceTicker: 'US.AMD', targetTicker: 'US.NVDA' },
    { sourceTicker: 'US.NVDA', targetTicker: 'US.TSM' },
  ],
};

function geminiJsonResponse(edges: unknown) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ edges }) }] } }],
    }),
  } as Response;
}

describe('GeminiAdapter', () => {
  beforeEach(() => { process.env.GEMINI_API_KEY = 'test-key'; });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns CompanyEdgeDraft[] with the identical shape to Claude', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiJsonResponse([
      { sourceTicker: 'US.AMD', targetTicker: 'US.NVDA', type: 'competitor', confidence: 0.9 },
      { sourceTicker: 'US.NVDA', targetTicker: 'US.TSM', type: 'supplier', confidence: 0.8 },
    ])));
    const out = await new GeminiAdapter().classifyEdges(input);
    expect(out).toEqual([
      { sourceTicker: 'US.AMD', targetTicker: 'US.NVDA', type: 'competitor', confidence: 0.9 },
      { sourceTicker: 'US.NVDA', targetTicker: 'US.TSM', type: 'supplier', confidence: 0.8 },
    ]);
  });

  it('drops drafts referencing unknown tickers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiJsonResponse([
      { sourceTicker: 'US.GHOST', targetTicker: 'US.NVDA', type: 'competitor', confidence: 0.9 },
    ])));
    const out = await new GeminiAdapter().classifyEdges(input);
    expect(out).toEqual([]);
  });

  it('returns [] when there are no candidate pairs (no network call)', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const out = await new GeminiAdapter().classifyEdges({ companies: input.companies, candidatePairs: [] });
    expect(out).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it('returns [] (graceful) when the API call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 } as Response));
    const out = await new GeminiAdapter().classifyEdges(input);
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/server/knowledge-graph/llm/gemini-adapter.test.ts`
Expected: FAIL — cannot find module `./gemini-adapter`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/server/knowledge-graph/llm/gemini-adapter.ts`:

```ts
import type {
  CompanyEdgeDraft,
  EdgeClassificationInput,
  LLMProvider,
} from '../types';
import { sanitizeDrafts, buildClassificationPrompt } from './shared';

// Flat responseSchema — Gemini supports only a subset of JSON Schema and rejects
// deeply nested / large schemas, so we keep it to one array of flat objects.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sourceTicker: { type: 'string' },
          targetTicker: { type: 'string' },
          type: { type: 'string', enum: ['competitor', 'supplier', 'customer'] },
          confidence: { type: 'number' },
        },
        required: ['sourceTicker', 'targetTicker', 'type', 'confidence'],
      },
    },
  },
  required: ['edges'],
};

export class GeminiAdapter implements LLMProvider {
  readonly name = 'gemini' as const;

  async classifyEdges(input: EdgeClassificationInput): Promise<CompanyEdgeDraft[]> {
    if (input.candidatePairs.length === 0) return [];

    const model = process.env.KG_GEMINI_MODEL ?? 'gemini-flash-lite-latest';
    const key = process.env.GEMINI_API_KEY ?? '';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildClassificationPrompt(input) }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) return [];
      const payload = await res.json();
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
      let edges: unknown = [];
      try { edges = JSON.parse(text).edges ?? []; } catch { edges = []; }
      return sanitizeDrafts(edges, input);
    } catch {
      return [];
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/server/knowledge-graph/llm/gemini-adapter.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/knowledge-graph/llm/gemini-adapter.ts src/lib/server/knowledge-graph/llm/gemini-adapter.test.ts
git commit -m "feat(knowledge-graph): Gemini adapter (responseSchema) + tests"
```

---

## Task 9: Provider factory

**Files:**
- Create: `src/lib/server/knowledge-graph/llm/index.ts`

- [ ] **Step 1: Write the factory**

Create `src/lib/server/knowledge-graph/llm/index.ts`:

```ts
import { env } from '$env/dynamic/private';
import type { LLMProvider } from '../types';
import { ClaudeAdapter } from './claude-adapter';
import { GeminiAdapter } from './gemini-adapter';

/**
 * Returns the configured LLM provider, or null when the chosen provider has no
 * API key (semantic layer is then skipped; structural edges still render).
 * Swap providers with a single env change: LLM_PROVIDER=claude|gemini.
 */
export function getLLMProvider(): LLMProvider | null {
  const provider = (env.LLM_PROVIDER ?? 'claude').toLowerCase();
  if (provider === 'gemini') {
    return env.GEMINI_API_KEY ? new GeminiAdapter() : null;
  }
  return env.ANTHROPIC_API_KEY ? new ClaudeAdapter() : null;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors mentioning `llm/index.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/knowledge-graph/llm/index.ts
git commit -m "feat(knowledge-graph): env-driven LLM provider factory"
```

---

## Task 10: Pipeline (orchestration + persist)

**Files:**
- Create: `src/lib/server/knowledge-graph/pipeline.ts`

- [ ] **Step 1: Write the pipeline module**

Create `src/lib/server/knowledge-graph/pipeline.ts`:

```ts
import { env } from '$env/dynamic/private';
import { prisma } from '$lib/server/db';
import type { GraphEdge, PlateMembership } from './types';
import { getPlateMembership, getInstitutionalHolders } from './plate-source';
import { generateStructuralEdges, candidatePairsFromEdges } from './structural-edges';
import { getLLMProvider } from './llm';

const OPTION_RE = /\d{6}[CP]\d+$/i;

function toMoomooCode(symbol: string): string {
  const s = (symbol || '').trim().toUpperCase();
  if (/^(US|HK|SH|SZ|SG|MY|CN)\./.test(s)) return s;
  const suffix = s.match(/^(.+)\.(HK|KL|SS|SZ|SI)$/);
  if (suffix) {
    const mk = { HK: 'HK', KL: 'MY', SS: 'SH', SZ: 'SZ', SI: 'SG' }[suffix[2]] ?? suffix[2];
    let code = suffix[1];
    if (mk === 'HK' && /^\d+$/.test(code)) code = code.padStart(5, '0');
    return `${mk}.${code}`;
  }
  return `US.${s}`;
}

function isOption(symbol: string): boolean {
  return OPTION_RE.test(symbol.split('.').pop() ?? '');
}

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
    const drafts = await provider.classifyEdges({
      companies: members.map((m) => ({ ticker: m.ticker, name: m.name, sector: m.sector })),
      candidatePairs: candidatePairsFromEdges(structural),
    });
    const groundingByPair = new Map(
      structural
        .filter((e) => e.type === 'same_sector' || e.type === 'same_concept')
        .map((e) => [`${e.sourceTicker}|${e.targetTicker}`, e.groundedSource])
    );
    semantic = drafts
      .filter((d) => d.confidence >= threshold)
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors mentioning `pipeline.ts`. (`prisma.companyNode` / `prisma.companyEdge` exist after Task 1's `prisma generate`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/knowledge-graph/pipeline.ts
git commit -m "feat(knowledge-graph): pipeline orchestration + idempotent persist"
```

---

## Task 11: Refresh endpoint

**Files:**
- Create: `src/routes/api/knowledge-graph/refresh/+server.ts`

- [ ] **Step 1: Write the endpoint**

Create `src/routes/api/knowledge-graph/refresh/+server.ts`:

```ts
import { json } from '@sveltejs/kit';
import { runKnowledgeGraphPipeline } from '$lib/server/knowledge-graph/pipeline';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
  const force = url.searchParams.get('force') === 'true';
  try {
    const result = await runKnowledgeGraphPipeline(locals.user.id, { force });
    if (result.tickers === 0) {
      return json({ ...result, message: 'No positions found to map.' });
    }
    return json({ ...result, message: 'Knowledge graph updated. Reload to view.' });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Knowledge graph build failed' },
      { status: 502 }
    );
  }
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors mentioning `knowledge-graph/refresh`.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/knowledge-graph/refresh/+server.ts
git commit -m "feat(knowledge-graph): POST refresh endpoint"
```

---

## Task 12: Page load, chart component, and page

**Files:**
- Create: `src/routes/knowledge-graph/+page.server.ts`
- Create: `src/lib/components/portfolioai/charts/KnowledgeGraphChart.svelte`
- Create: `src/routes/knowledge-graph/+page.svelte`

- [ ] **Step 1: Write the page load**

Create `src/routes/knowledge-graph/+page.server.ts`:

```ts
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
```

- [ ] **Step 2: Write the ECharts graph component**

Create `src/lib/components/portfolioai/charts/KnowledgeGraphChart.svelte`:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getChartTheme } from '$lib/echarts.config';
  import { theme } from '$lib/stores/ui';

  export let nodes: { ticker: string; name: string; sector: string | null; market: string | null }[] = [];
  export let edges: {
    source: string; target: string; type: string; weight: number;
    confidence: number | null; groundedSource: string | null;
  }[] = [];

  let container: HTMLDivElement;
  let chart: import('echarts').ECharts | null = null;

  // Semantic edges colored by type; structural edges muted. Width ∝ weight.
  const EDGE_COLOR: Record<string, string> = {
    competitor: '#f96b7e',
    supplier: '#2dd4a0',
    customer: '#fbbf24',
    same_sector: '#4b5563',
    same_concept: '#6b7280',
    co_owned_by: '#a78bfa',
  };
  const STRUCTURAL = new Set(['same_sector', 'same_concept', 'co_owned_by']);

  $: if (chart) updateChart(nodes, edges);
  $: if (chart && $theme) updateChart(nodes, edges);

  function buildOption(
    ns: typeof nodes,
    es: typeof edges
  ) {
    const ct = getChartTheme();
    return {
      ...ct,
      tooltip: {
        formatter: (p: { dataType: string; data: Record<string, unknown> }) => {
          if (p.dataType === 'edge') {
            const d = p.data;
            const conf = d.confidence == null ? 'fact' : `confidence ${(Number(d.confidence) * 100).toFixed(0)}%`;
            return `${d.source} → ${d.target}<br/>${d.relType} (${conf})<br/><small>${d.grounded ?? ''}</small>`;
          }
          return `${p.data.name}`;
        },
      },
      legend: [{
        data: ['competitor', 'supplier', 'customer', 'structural'],
        textStyle: { color: ct.legend.textStyle.color, fontSize: 11 },
        top: 0,
      }],
      series: [{
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        focusNodeAdjacency: true,
        force: { repulsion: 220, edgeLength: 120, gravity: 0.08 },
        label: { show: true, position: 'right', color: ct.legend.textStyle.color, fontSize: 11 },
        emphasis: { focus: 'adjacency', lineStyle: { width: 4 } },
        data: ns.map((n) => ({ name: n.ticker, value: n.name, symbolSize: 34,
          itemStyle: { color: '#6c8fff' } })),
        links: es.map((e) => ({
          source: e.source,
          target: e.target,
          relType: e.type,
          confidence: e.confidence,
          grounded: e.groundedSource,
          lineStyle: {
            color: EDGE_COLOR[e.type] ?? '#3a4458',
            width: Math.min(1 + e.weight, 6),
            type: STRUCTURAL.has(e.type) ? 'dashed' : 'solid',
            opacity: STRUCTURAL.has(e.type) ? 0.45 : 0.9,
          },
        })),
      }],
    };
  }

  function updateChart(ns: typeof nodes, es: typeof edges) {
    chart?.setOption(buildOption(ns, es), true);
  }

  onMount(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;
    import('echarts').then((echarts) => {
      if (disposed) return;
      chart = echarts.init(container, null, { renderer: 'canvas' });
      updateChart(nodes, edges);
      ro = new ResizeObserver(() => chart?.resize());
      ro.observe(container);
    });
    return () => { disposed = true; ro?.disconnect(); };
  });

  onDestroy(() => chart?.dispose());
</script>

<div bind:this={container} class="kg-canvas"></div>

<style>
  .kg-canvas { width: 100%; height: 560px; }
</style>
```
- [ ] **Step 3: Write the page**

Create `src/routes/knowledge-graph/+page.svelte`:

```svelte
<script lang="ts">
  import KnowledgeGraphChart from '$lib/components/portfolioai/charts/KnowledgeGraphChart.svelte';
  import { invalidateAll } from '$app/navigation';

  export let data: {
    nodes: { ticker: string; name: string; sector: string | null; market: string | null }[];
    edges: { source: string; target: string; type: string; weight: number; confidence: number | null; groundedSource: string | null }[];
    hasPositions: boolean;
  };

  let refreshing = false;
  let message = '';

  async function refresh() {
    refreshing = true;
    message = 'Building graph…';
    try {
      const res = await fetch('/api/knowledge-graph/refresh', { method: 'POST' });
      const body = await res.json();
      message = body.message ?? body.error ?? 'Done.';
      await invalidateAll();
    } catch {
      message = 'Refresh failed.';
    } finally {
      refreshing = false;
    }
  }
</script>

<div class="kg-page">
  <header class="kg-header">
    <div>
      <h1>Knowledge Graph</h1>
      <p class="kg-sub">Relationships between your holdings — structural facts (dashed) and AI-classified links (solid).</p>
    </div>
    <button class="kg-refresh" on:click={refresh} disabled={refreshing}>
      {refreshing ? 'Building…' : 'Rebuild graph'}
    </button>
  </header>

  {#if message}<div class="kg-msg">{message}</div>{/if}

  {#if data.nodes.length}
    <KnowledgeGraphChart nodes={data.nodes} edges={data.edges} />
  {:else}
    <div class="kg-empty">
      {data.hasPositions
        ? 'No graph yet. Click “Rebuild graph” to map your positions.'
        : 'No positions found. Sync your broker first.'}
    </div>
  {/if}

  <p class="kg-disclaimer">Untuk tujuan pendidikan sahaja — bukan nasihat kewangan</p>
</div>

<style>
  .kg-page { padding: 20px; }
  .kg-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
  .kg-header h1 { font-size: 1.1rem; font-weight: 700; color: var(--text); margin: 0; }
  .kg-sub { font-size: 0.78rem; color: var(--muted); margin: 4px 0 0; max-width: 60ch; }
  .kg-refresh {
    padding: 8px 14px; border-radius: 6px; font-size: 0.78rem; font-weight: 600;
    color: var(--primary); background: rgba(var(--primary-rgb), 0.15);
    border: 1px solid rgba(var(--primary-rgb), 0.3); cursor: pointer;
  }
  .kg-refresh:disabled { opacity: 0.6; cursor: default; }
  .kg-msg { font-size: 0.75rem; color: var(--muted); margin-bottom: 10px; }
  .kg-empty {
    height: 320px; display: grid; place-items: center; color: var(--muted);
    background: var(--card); border: 1px solid var(--border); border-radius: 10px; font-size: 0.85rem;
  }
  .kg-disclaimer { margin-top: 14px; font-size: 0.7rem; color: var(--muted); font-style: italic; }
</style>
```

- [ ] **Step 4: Type-check + build the route**

Run: `npx tsc --noEmit -p tsconfig.json` then `npx svelte-check --threshold error`
Expected: no errors mentioning `knowledge-graph`.

- [ ] **Step 5: Manual smoke test**

Start the bridge + dev server (dev must run on port 5173 — see memory). Log in, open `/knowledge-graph`, click **Rebuild graph**. Expected: message "Knowledge graph updated", graph renders with dashed structural edges; semantic edges appear if `LLM_PROVIDER` + key are set. Verify a second **Rebuild** is faster (Redis cache hit; no bridge plate calls in `moomoo-service` logs).

- [ ] **Step 6: Commit**

```bash
git add src/routes/knowledge-graph src/lib/components/portfolioai/charts/KnowledgeGraphChart.svelte
git commit -m "feat(knowledge-graph): graph page, ECharts graph component, refresh UI"
```

---

## Task 13: Full-suite verification

- [ ] **Step 1: Run the JS test suite**

Run: `npm test -- src/lib/server/knowledge-graph`
Expected: all knowledge-graph Vitest suites PASS.

- [ ] **Step 2: Run the Python bridge tests**

Run: `python -m unittest discover -s moomoo-service/tests`
Expected: `OK`.

- [ ] **Step 3: Confirm no existing migration was altered**

Run: `git diff --stat master -- prisma/migrations`
Expected: only the single new `add_company_knowledge_graph` migration folder is added; no existing migration file is modified.

- [ ] **Step 4: Final commit (if any lint/format fixes were needed)**

```bash
git add -A
git commit -m "chore(knowledge-graph): verification pass"
```

---

## Self-review notes (spec coverage)

- **Two new Prisma models, flat, no existing model touched** → Task 1.
- **owner-plate full membership (industry + concept) + 200/req limit + split-on-error** → Tasks 2–3.
- **Institutional holdings best-effort** → Task 3 (`/quotes/institutional-holders`).
- **Redis 24h cache, second run no redundant calls** → Task 6 + Task 12 Step 5 verification.
- **Structural edges deterministic, confidence=null, grounded on plate_code** → Task 5.
- **Pluggable LLM, identical shape, env-selected, never invents tickers** → Tasks 4,7,8,9 (+ `sanitizeDrafts`).
- **Grounding + confidence threshold (default 0.5)** → Task 10.
- **SvelteKit endpoint + ECharts graph + disclaimer** → Tasks 11–12.
- **Tests: adapters (mocked), structural gen (fixture), bridge batching/split (mocked OpenD via `collect_plate_membership`)** → Tasks 2,5,7,8.
