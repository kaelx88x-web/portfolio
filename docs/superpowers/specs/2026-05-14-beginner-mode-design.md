# Beginner Mode — Design Spec
**Date:** 2026-05-14  
**Scope:** Portfolio AI UI — Beginner/Advanced toggle for new users

---

## Problem

Portfolio AI exposes too many features at once for two types of beginners:
- **Investment beginners** — don't know what "Holdings", "Unrealized P&L", "Benchmark" mean
- **App beginners** — understand investing but don't know where to start in this app

The sidebar has 32 sub-items across 8 groups with technical labels. The dashboard shows jargon ("Day P&L", "Total Return", "Concentration Risk") without context.

---

## Solution

A **Beginner/Advanced toggle** in the sidebar. Mode persists in `localStorage`. No new routes required.

---

## Sidebar — Beginner Mode

5 items replace the full accordion nav. Each has a subtitle describing its function in plain language.

| Label | Subtitle | Route |
|-------|----------|-------|
| Dashboard | — | `/dashboard` |
| My Portfolio | Saham & pelaburan anda | `/holdings` |
| Add Data | Import dari Moomoo atau CSV | `/import` |
| My Returns | Untung rugi pelaburan anda | `/analytics/portfolio` |
| Watchlist | Saham yang anda pantau | `/watchlist` |
| Ask AI | Tanya soalan tentang portfolio | `/ai/copilot` |

**Coming Soon items** (Optimization, Multi-Agent AI, Quant Lab) are hidden in Beginner mode.

**Toggle UI** — bottom of sidebar, above Settings:
- Beginner ON: green pill, label "BEGINNER MODE", text "Tukar ke Advanced →"
- Advanced ON: blue pill, label "ADVANCED MODE", text "← Tukar ke Beginner"

**State:** `localStorage` key `portfolioai_mode`, values `'beginner' | 'advanced'`. Default: `'beginner'`.

---

## Dashboard — Beginner Mode

### Welcome banner
Shown when mode is beginner:
```
👋 Selamat datang ke PortfolioAI
   Layari bahagian dengan ikon ? untuk belajar apa maksudnya
```

### Stat card label mapping

| Advanced label | Beginner label | Tooltip text |
|---|---|---|
| Portfolio Value | Nilai Portfolio | Jumlah nilai semua pelaburan anda pada harga pasaran semasa |
| Day P&L | Untung Rugi Hari Ini | Perbezaan nilai portfolio anda berbanding semalam |
| Total Return | Jumlah Untung | Keuntungan atau kerugian keseluruhan sejak anda mula melabur |
| Holdings | Bil. Saham Dipegang | Berapa banyak jenis saham atau pelaburan yang anda ada |

Each StatCard receives an optional `tooltip` prop. When set, a small `?` icon appears beside the label; hover shows the tooltip text.

### AI Insight card plain-language variants

| Advanced title | Beginner title | Expanded explanation |
|---|---|---|
| ⚠ Concentration Risk | ⚠ Pelaburan Terlalu Tertumpu | "X% daripada wang anda ada dalam Y saham sahaja. Ini bermakna risiko tinggi — kalau satu saham jatuh, portfolio anda terkesan besar." |
| ◉ Sector Allocation | ◉ Agihan Sektor | "X adalah sektor terbesar pada Y% portfolio. [Plain advice]." |
| ↗ Total Return | ↗ Prestasi Portfolio | "Portfolio anda [naik/turun] X% dari modal asal. [Plain context]." |

---

## Implementation

### Files changed

| File | Change |
|---|---|
| `src/lib/components/portfolioai/Sidebar.svelte` | Add mode state (localStorage), conditional nav render, toggle button |
| `src/lib/components/portfolioai/StatCard.svelte` | Add optional `tooltip: string` prop, render `?` icon with title attribute |
| `src/routes/dashboard/+page.svelte` | Read `portfolioai_mode` from localStorage, swap labels + insight text in Beginner mode |
| `src/lib/components/portfolioai/AIInsightCard.svelte` | Accept optional `plainTitle` and `plainSummary` props for Beginner mode |

### No new routes, no server changes, no DB changes.

---

## Behaviour rules

- Mode defaults to `'beginner'` on first visit (key absent from localStorage).
- Toggling writes to localStorage immediately and re-renders sidebar reactively.
- Advanced mode: sidebar identical to current state — zero visual regression.
- Beginner mode on dashboard: only label/text differs, all data and chart logic unchanged.
- `?` tooltip uses native `title` attribute (no JS dependency).

---

## Out of scope

- Onboarding wizard / setup checklist (Option B — not chosen)
- Dedicated `/start` page (Option C — not chosen)
- Per-page "beginner explanations" beyond dashboard stat cards and insight cards
- Glossary page
