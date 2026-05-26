# Landing Page Upgrade Design

**Date:** 2026-05-26
**Status:** Approved
**Goal:** Upgrade the existing `src/routes/+page.svelte` landing page to institutional-grade positioning — adding a stats strip, AI deep-dive section, and competitor scorecard — to compete with AllInvestView and similar trackers on a global audience.

---

## Context

The existing landing page has a working foundation (nav, hero, features grid, how-it-works, CTA, footer) but lacks:
- Institutional positioning ("serious investor" angle)
- Social proof numbers (stats strip)
- AI showcase beyond a feature card
- Competitor differentiation

AllInvestView (4.8-rated competitor) wins on: clear free-tier messaging, comparison tables, SEO positioning, "TOP PICK" social proof. PortfolioAI wins on: AI suite (5 tools vs 0), institutional analytics (alpha/beta/drawdown/stress test), live broker sync, optimizer — none of which are surfaced clearly on the current landing page.

---

## Positioning

**Angle:** Institutional-Grade — "Portfolio Intelligence Built for Serious Investors"
**Market:** Global
**Tagline:** "Alpha, beta, stress testing, AI copilot, live broker sync — tools used by fund managers, now for individual investors. Free to start."
**Key differentiator:** AI suite (5 tools) + institutional analytics — no competitor offers both free.

---

## Section Structure

The upgrade follows a **C — Balanced** layout: keep existing features grid, add stats strip, new AI deep-dive section, new competitor scorecard. Sections in order:

| # | Section | Status | Key change |
|---|---------|--------|-----------|
| — | Nav | Keep | Add "AI Tools" and "Compare" links |
| ① | Hero | Upgrade | New headline, institutional badge, AI chat preview panel, alpha stat |
| ② | Stats Strip + Features | Upgrade | Add 4-stat strip above existing features grid |
| ③ | AI Deep Dive | **New** | Tabbed section, one panel per AI tool |
| ④ | Competitor Scorecard | **New** | 5 category win cards + inline free CTA card |
| ⑤ | CTA | Upgrade | New copy: "institutional clarity" framing |
| — | How it works | Keep | No change — 3-step section preserved as-is |
| — | Footer | Keep | No change |

---

## Section Specifications

### ① Hero (Upgrade)

**Headline:** "Portfolio Analytics for Serious Investors"
**Gradient word:** "Serious Investors" (blue → green gradient, matching existing `--primary` → `--success`)
**Badge:** `✦ INSTITUTIONAL-GRADE PORTFOLIO INTELLIGENCE` (green, top-left)
**Subheadline:** "Alpha, beta, stress testing, AI copilot, live broker sync — tools used by fund managers, now accessible to individual investors. Free to start."
**CTA buttons:** "Open Free Dashboard →" (primary) + "See AI in action" (outline, anchors to AI section)
**Powered-by strip:** Moomoo OpenD · Claude AI · Finnhub (keep existing)

**Right panel (replace existing panels):**
- AI Copilot chat preview: user question + AI response showing real portfolio language (concentration risk, institutional threshold)
- 3-stat mini-strip below: Portfolio Value · AI Risk Score · Alpha vs SPY

### ② Stats Strip + Features Grid (Upgrade)

**Stats strip** — 4-column row added above existing features grid:
| Stat | Label |
|------|-------|
| 60+ | Analytics pages |
| 8 | AI tools |
| Live | Broker sync |
| Free | To start |

**Features grid** — keep existing 8 cards. Update copy on 2 cards:
- "AI Portfolio Copilot" → keep, just tighten copy
- "Portfolio Tracking" → rename to "Portfolio Tracking + Snapshots"

**Section headline:** "Institutional tools. Zero setup."
**Section label:** `EVERYTHING IN ONE WORKSPACE` (small caps, blue)

### ③ AI Deep Dive (New)

**Section label:** `✦ AI SUITE — 5 TOOLS`
**Headline:** "AI that understands your portfolio"
**Subheadline:** "Not a generic chatbot. An AI that knows your holdings, risk profile, allocation, and performance — and gives answers that matter."

**Tab bar** — 5 tabs, one per tool:
| Tab | Tool | Active style |
|-----|------|-------------|
| 💬 Copilot | AI Portfolio Copilot | Green accent |
| 🛡️ Risk Advisor | AI Risk Advisor | — |
| 🧠 Portfolio Asst | Portfolio Assistant | — |
| 🗂️ Memory | AI Memory | — |
| 💡 Insights | AI Insights | — |

**Default active tab:** Copilot

**Panel layout:** 2-column — left: copy + bullet list, right: mockup screen
- Left: tool name (h3), description paragraph, 4 bullet points (what it knows/does)
- Right: dark-bg mockup showing a realistic chat exchange or UI snippet

**Tab switching:** CSS-only (`:target` or Svelte `bind:group`) — no server roundtrip. Static content per tab, pre-rendered.

**Copilot panel content:**
- Copy: "Ask anything about your portfolio in plain English. Get instant, context-aware answers about risk, performance, allocation, and what to watch."
- Bullets: "Knows your actual holdings and weights", "Understands your benchmark and performance", "Flags concentration risk and anomalies", "Suggests follow-up questions automatically"
- Mockup: user asks "Am I too concentrated in tech?" → AI responds with sector % and top-3 breakdown

### ④ Competitor Scorecard (New)

**Section label:** `WHY PORTFOLIOAI`
**Headline:** "Built for investors who want more than a tracker"
**Subheadline:** "Most portfolio apps show you what you own. PortfolioAI tells you what it means."

**Grid:** 3 columns × 2 rows = 5 win cards + 1 free CTA card

| Card | Icon | Title | Description | vs competitors |
|------|------|-------|-------------|----------------|
| 1 | 🤖 | AI Suite | 5 AI tools purpose-built for portfolio analysis. Not a generic chatbot. | AllInvestView ✗ · Yahoo ✗ · Ghostfolio ✗ |
| 2 | 📊 | Institutional Analytics | Alpha, beta, Sharpe, max drawdown, stress testing, correlation matrix. | Others: basic metrics only |
| 3 | ⚡ | Portfolio Optimizer | Rebalancing recommendations, scenario simulation, stress test modeling. | No competitor offers this free |
| 4 | 🔗 | Live Broker Sync | Positions pulled live from your broker. No manual CSV import needed. | AllInvestView ✗ · Yahoo ✗ |
| 5 | 🌐 | Market Intelligence | SEC insider trades, capital flow, global market status — not just prices. | Yahoo partial · Others ✗ |
| 6 | CTA | Free to start | Full dashboard access. No credit card. No trial period. | — |

**Win card styling:** subtle top-border gradient (green), dark background, competitor names in muted red (`✗`)
**CTA card (6th):** blue accent, "Free" in large type, inline "Open Dashboard →" button

### ⑤ CTA Section (Upgrade)

**Headline:** "Ready to invest with institutional clarity?"
**Subheadline:** "Open the dashboard — free to start, no credit card required."
**Button:** "Open Free Dashboard →" (primary, large)
**Note below button:** "Full access · No trial · No credit card" (small muted text)

---

## Nav Updates

Add two links to existing nav:
- "AI Tools" → anchors to `#ai` section
- "Compare" → anchors to `#compare` section

Existing links "Features" and "How it works" kept. "Demo" link kept.

---

## Component Architecture

All changes are in **one file**: `src/routes/+page.svelte`. No new routes, no new components, no server changes.

| Element | Approach |
|---------|---------|
| Tab switching (AI section) | Svelte `let activeTab` + `{#if}` blocks — client-side only |
| Stats strip | Static HTML/CSS — no data fetching |
| Scorecard grid | Static HTML/CSS — hardcoded competitor data |
| Hero AI preview | Static mock — hardcoded chat messages |
| Styles | Scoped `<style>` block, uses existing CSS variables (`--primary`, `--success`, `--card`, etc.) |

No new dependencies. No new API calls. No new Svelte stores.

---

## CSS Variables Used

All styles use existing CSS custom properties already defined in `app.css`:
- `--bg`, `--card`, `--surface-1`
- `--primary`, `--primary-rgb`
- `--success`, `--success-rgb`
- `--danger`, `--danger-rgb`
- `--warning`, `--warning-rgb`
- `--text`, `--muted`
- `--border`, `--overlay-border`

No new CSS variables needed.

---

## What This Does NOT Change

- Route structure — `+page.svelte` stays at `/`
- Auth or server-side logic — page has no `+page.server.ts`, stays static
- App shell / dashboard — zero impact on the authenticated app
- Dark mode — existing CSS variables handle theming automatically
- Mobile responsive — existing breakpoints extended to cover new sections

---

## Mobile Responsive Rules

| Section | ≤860px | ≤600px |
|---------|--------|--------|
| Hero | Stack to 1 column (already done) | — |
| Stats strip | 2×2 grid | 2×2 grid |
| Features grid | 2 columns | 1 column (already done) |
| AI tab bar | Wrap, scrollable | Horizontal scroll |
| AI panel | Stack to 1 column | 1 column |
| Scorecard grid | 2 columns | 1 column |

---

## Success Criteria

- Landing page clearly positions as institutional-grade, not a generic free tracker
- "AI Suite" and "Institutional Analytics" are the two dominant visual hooks above the fold or within first scroll
- Competitor scorecard visible without needing to scroll past 3 full sections
- All 5 AI tools have named entries in the tab section
- Nav has "AI Tools" and "Compare" anchor links
- Page loads without new server calls — fully static
- All existing sections (features grid, how-it-works, footer) preserved
- Mobile layout works at 375px width

---

## Out of Scope

- SEO comparison pages (`/compare/*`) — Phase 2
- Pricing page (`/pricing`) — Phase 3
- Blog/content (`/blog/*`) — Phase 4
- Animation / scroll effects beyond existing transitions
- A/B testing infrastructure
- Analytics tracking (GA, Plausible)
- Real user testimonials or review ratings
