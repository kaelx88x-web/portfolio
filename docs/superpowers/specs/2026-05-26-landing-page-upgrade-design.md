# Landing Page Upgrade Design

**Date:** 2026-05-26
**Status:** Approved
**Goal:** Upgrade the existing `src/routes/+page.svelte` landing page to institutional-grade positioning — adding a live market pulse, stats strip, AI deep-dive section, portfolio health snapshot, institutional metrics preview, options intelligence, AI daily briefing, and competitor scorecard — to compete with AllInvestView and similar trackers on a global audience.

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
| — | Nav | Keep | Add "AI Tools", "Options", and "Compare" links |
| ⓪ | Live Market Pulse | **New** | Slim ticker bar above hero showing market regime, VIX, SPY/QQQ, and AI market state |
| ① | Hero | Upgrade | New headline, institutional badge, AI chat preview panel, alpha stat |
| ② | Stats Strip + Features | Upgrade | Add 4-stat strip above existing features grid |
| ③ | Portfolio Health Snapshot | **New** | Visual card showing health score, concentration risk, dividend yield, drawdown risk, and AI suggestion |
| ④ | Institutional Metrics Preview | **New** | Alpha, beta, Sharpe, max drawdown, volatility, and benchmark comparison cards |
| ⑤ | AI Deep Dive | **New** | Tabbed section, one panel per AI tool |
| ⑥ | AI Daily Briefing | **New** | Morning briefing mockup for portfolio health, theta income, risk alerts, and market regime |
| ⑦ | Options Intelligence | **New** | Wheel strategy, CSP, covered call, assignment risk, theta, and IV monitoring section |
| ⑧ | Competitor Scorecard | **New** | 5 category win cards + inline free CTA card |
| ⑨ | Trust, Privacy & Explainability | **New** | Read-only sync, encrypted data messaging, and AI reasoning transparency |
| ⑩ | CTA | Upgrade | New copy: "institutional clarity" framing |
| — | How it works | Keep | No change — 3-step section preserved as-is |
| — | Footer | Keep | No change |

---

## Section Specifications

### ⓪ Live Market Pulse (New)

**Purpose:** Give the landing page a live, market-aware fintech feeling immediately above the hero. This makes PortfolioAI feel active instead of static.

**Placement:** Above the hero section, below nav.

**Layout:** Slim horizontal ticker bar with glass/dark background. Desktop shows all items inline; mobile becomes horizontal scroll.

**Items:**
| Item | Example value | Purpose |
|------|---------------|---------|
| SPY | `+0.82%` | Broad market cue |
| QQQ | `+1.14%` | Growth/tech cue |
| VIX | `18.2` | Risk/volatility cue |
| Fear & Greed | `Neutral` | Sentiment cue |
| Market Regime | `Risk-On` | AI-readable market state |

**Copy example:**
`LIVE MARKET PULSE · SPY +0.82% · QQQ +1.14% · VIX 18.2 · REGIME: RISK-ON`

**Implementation note:** Static mock values for landing page only. No API call in this phase.

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

### ③ Portfolio Health Snapshot (New)

**Purpose:** Show that PortfolioAI gives practical, investor-friendly portfolio diagnosis, not just charts.

**Section label:** `PORTFOLIO HEALTH`
**Headline:** "Know what your portfolio is really telling you"
**Subheadline:** "PortfolioAI turns holdings, allocation, income, risk, and performance into one clear health snapshot."

**Main card example:**
```txt
Portfolio Health: Moderate ⚠️

Portfolio Value: $24,820
Tech Exposure: 41%
Dividend Yield: 5.8%
Max Drawdown Risk: Medium

AI Suggestion:
Reduce concentration in NVDA and increase defensive ETF allocation by 5%.
```

**Supporting mini cards:**
| Card | Value | Note |
|------|-------|------|
| Concentration Risk | Medium | Top 3 holdings = 38% |
| Income Quality | Stable | Monthly yield improving |
| Benchmark Gap | +2.4% | Outperforming SPY |
| Action Needed | 1 alert | Review tech exposure |

---

### ④ Institutional Metrics Preview (New)

**Purpose:** Make institutional analytics visible instead of only mentioned in text.

**Section label:** `INSTITUTIONAL METRICS`
**Headline:** "Fund-manager metrics, explained simply"
**Subheadline:** "Alpha, beta, Sharpe ratio, volatility, drawdown, and benchmark comparison — translated into plain English."

**Metric cards:**
| Metric | Example | Plain-English label |
|--------|---------|--------------------|
| Alpha | `+3.2%` | Extra return vs benchmark |
| Beta | `1.08` | Slightly more volatile than market |
| Sharpe Ratio | `1.42` | Good risk-adjusted return |
| Max Drawdown | `-11.8%` | Worst historical drop |
| Volatility | `14.6%` | Medium movement risk |
| Correlation | `0.82` | Closely follows SPY |

**Optional UI:** Add small sparkline placeholders inside each card. Static SVG or CSS line is enough. No chart dependency needed.

---

### ⑤ AI Deep Dive (New)

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

### ⑥ AI Daily Briefing (New)

**Purpose:** Create a premium daily habit hook. Users immediately understand the product can brief them every morning like a personal portfolio analyst.

**Section label:** `DAILY AI BRIEFING`
**Headline:** "Start the day with a portfolio briefing"
**Subheadline:** "PortfolioAI summarizes risk, income, market regime, and watchlist alerts before the market opens."

**Mockup copy:**
```txt
Good morning, Azhar.

PORTFOLIO HEALTH: Moderate ⚠️

Theta earned today:        +$12.40
Net unrealized P&L:        -$31.82
Premium collected total:   +$248.00

⚠️ NIO covered call expires in 3 days
Strike $5.50 | Current $5.44
→ Consider: let expire or roll if ITM risk increases

✅ RUM put is profitable
→ Consider closing early at 80% max profit

MARKET REGIME: Bearish bias today
VIX elevated | Breadth negative

→ Avoid opening new high-risk positions today.
```

**Design:** Large mock terminal/card with green, yellow, and muted danger accents. On mobile, full-width card.

---

### ⑦ Options Intelligence (New)

**Purpose:** Separate PortfolioAI from normal stock trackers by showing support for options income strategies.

**Section label:** `OPTIONS INTELLIGENCE`
**Headline:** "Built for stock investors and options income traders"
**Subheadline:** "Track covered calls, cash-secured puts, wheel strategy risk, assignment exposure, theta income, and IV conditions in one place."

**Feature cards:**
| Feature | Description |
|---------|-------------|
| Cash-Secured Put Monitor | Tracks collateral, breakeven, expiry, and assignment risk |
| Covered Call Tracker | Shows strike distance, share coverage, premium collected, and buyback zone |
| Wheel Strategy View | Connects put → assignment → covered call → exit cycle |
| Theta Income Tracker | Tracks daily, weekly, and monthly premium income |
| IV & Expiry Alerts | Flags high-IV opportunities and risky expiries |
| 50% Profit Rule | Highlights contracts suitable for early close |

**Mockup example:**
```txt
NIO $5.50 Covered Call
Expiry: 3 days
Premium collected: $18.00
Current buyback: $8.00
Profit captured: 55%
AI action: Consider closing early if risk/reward is no longer attractive.
```

**Implementation note:** Static landing page content only. Actual options engine remains inside the app roadmap.

---

### ⑧ Competitor Scorecard (New)

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

### ⑨ Trust, Privacy & Explainability (New)

**Purpose:** Reduce fear around broker sync and AI recommendations. Serious investors need to know the platform is safe, explainable, and not blindly trading for them.

**Section label:** `TRUSTED AI`
**Headline:** "AI recommendations you can understand"
**Subheadline:** "Every insight shows the reason, data context, and risk behind the recommendation."

**Trust cards:**
| Card | Copy |
|------|------|
| Read-only broker sync | PortfolioAI can analyze holdings without needing trading permission by default |
| No auto-trading by default | Suggestions are shown to the user first; the user stays in control |
| Explainable AI | Each recommendation includes portfolio context, risk reason, and confidence score |
| Private portfolio data | Portfolio data should be encrypted and protected from public exposure |

**Explainability example:**
```txt
Recommendation: Reduce tech exposure
Reason: Technology is 41% of portfolio, above your 30% target
Risk: High correlation between NVDA, QQQ, and SOXL
Confidence: 82%
Suggested action: Rebalance 5% into defensive ETF or cash buffer
```

---

### ⑩ CTA Section (Upgrade)

**Headline:** "Ready to invest with institutional clarity?"
**Subheadline:** "Open the dashboard — free to start, no credit card required."
**Button:** "Open Free Dashboard →" (primary, large)
**Note below button:** "Full access · No trial · No credit card" (small muted text)

---

## Nav Updates

Add three links to existing nav:
- "AI Tools" → anchors to `#ai` section
- "Options" → anchors to `#options` section
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
| Live market pulse | Static mock ticker — no API call |
| Portfolio health snapshot | Static card — no API call |
| Institutional metrics preview | Static metric cards with optional CSS/SVG sparklines |
| AI daily briefing | Static mock card — no API call |
| Options intelligence | Static cards + mock option alert |
| Trust/explainability section | Static cards + recommendation explanation mock |
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
| Market pulse | Horizontal scroll | Horizontal scroll |
| Stats strip | 2×2 grid | 2×2 grid |
| Features grid | 2 columns | 1 column (already done) |
| Portfolio health | Stack cards | 1 column |
| Metrics preview | 2 columns | 1 column |
| AI tab bar | Wrap, scrollable | Horizontal scroll |
| AI panel | Stack to 1 column | 1 column |
| Daily briefing | Full width | Full width |
| Options intelligence | 2 columns | 1 column |
| Trust cards | 2 columns | 1 column |
| Scorecard grid | 2 columns | 1 column |

---

## Success Criteria

- Landing page clearly positions as institutional-grade, not a generic free tracker
- "AI Suite", "Portfolio Health", and "Institutional Analytics" are the dominant visual hooks above the fold or within first scroll
- Competitor scorecard visible without needing to scroll past 3 full sections
- All 5 AI tools have named entries in the tab section
- Live market pulse appears above hero without API calls
- Options Intelligence section clearly supports wheel strategy, CSP, covered call, theta, IV, and assignment risk
- AI Daily Briefing mockup communicates daily portfolio habit value
- Trust section clearly states read-only sync, user control, and explainable AI
- Nav has "AI Tools", "Options", and "Compare" anchor links
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
- Real-time market API integration for landing page ticker
- Auto-trading or order placement from landing page
