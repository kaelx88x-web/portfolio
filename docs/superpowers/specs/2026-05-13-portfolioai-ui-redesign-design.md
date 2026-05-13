# PortfolioAI UI Redesign — Design Spec
**Date:** 2026-05-13
**Scope:** Phase 1 — Core Shell (Design System + AppShell + Dashboard + Portfolio Section)
**Stack:** SvelteKit · TailwindCSS · TypeScript · ECharts

---

## 1. Product Vision

PortfolioAI is not a portfolio tracker. It is an **AI Portfolio Operating System** — a multi-agent finance platform, institutional analytics dashboard, and AI investment copilot. The UI must feel like:

> Bloomberg Lite + ChatGPT for Finance + Ghostfolio + OpenBB Terminal

The redesign upgrades the existing codebase incrementally. It does not break existing routes, services, or Prisma schema. It replaces the visual layer — design tokens, AppShell, Sidebar, Topbar, and page-level layouts — starting with the core shell and the two most-used sections (Dashboard + Portfolio).

---

## 2. Design System

### 2.1 Color Palette

All colors expressed as CSS custom properties on `:root`. Tailwind config extended to reference these tokens.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#080d18` | Page background |
| `--card` | `#0f1523` | Card / panel surface |
| `--border` | `#1a2038` | Borders, dividers |
| `--primary` | `#6c8fff` | Active nav, links, AI accents, primary actions |
| `--success` | `#2dd4a0` | Gains, positive P&L, healthy metrics |
| `--danger` | `#f96b7e` | Losses, risk alerts, negative P&L |
| `--warning` | `#fbbf24` | Drawdown warnings, caution states |
| `--text` | `#dce8ff` | Primary text |
| `--muted` | `#7a8fb0` | Labels, secondary text, placeholders |
| `--sidebar-bg` | `#090e1d` | Sidebar surface |
| `--ai-bg` | `#0e1830` | AI panel / AI card backgrounds |
| `--ai-border` | `rgba(108,143,255,0.25)` | AI component borders |
| `--radius` | `10px` | Standard card border radius |
| `--radius-sm` | `6px` | Small element border radius |
| `--shadow` | `0 4px 24px rgba(0,0,0,0.45)` | Card shadow |

**Semantic color mapping:**
- Positive P&L → `--success`
- Negative P&L → `--danger`
- AI-related UI → `--primary` (tinted backgrounds with `--ai-border`)
- Neutral metrics → `--text`
- Coming Soon / disabled → `--muted`

### 2.2 Typography

Font stack: `Inter, system-ui, -apple-system, sans-serif`

| Scale | Size | Weight | Use |
|---|---|---|---|
| `text-xs` | 0.65rem | 500–700 | Labels, badges, table headers |
| `text-sm` | 0.8rem | 400–600 | Body text, descriptions, table cells |
| `text-base` | 0.875rem | 400–600 | Default UI text |
| `text-lg` | 1.1rem | 600–700 | Page section headings |
| `text-xl` | 1.4rem | 700–800 | Stat card values, hero numbers |
| `text-2xl` | 1.8rem | 700–800 | Portfolio value hero in topbar |

Letter spacing: `tracking-wider` (0.08em) for uppercase labels. `tracking-tight` for large numbers.

### 2.3 Glassmorphism

Applied to AI components, stat cards (B variant), and the AI panel:
```css
background: linear-gradient(135deg, rgba(108,143,255,0.08), rgba(14,24,48,0.6));
border: 1px solid rgba(108,143,255,0.25);
backdrop-filter: blur(12px);
```

### 2.4 Chart Library

**ECharts** (`echarts` npm package). Reasons: superior dark theme support, canvas renderer performance for large datasets, better animation quality for finance charts. Replace any existing ApexCharts usage.

ECharts global dark theme config:
```ts
// src/lib/echarts.config.ts
export const CHART_THEME = {
  backgroundColor: 'transparent',
  textStyle: { color: '#7a8fb0', fontFamily: 'Inter, system-ui' },
  axisLine: { lineStyle: { color: '#1a2038' } },
  splitLine: { lineStyle: { color: '#1a203820' } },
  // primary series color order:
  color: ['#6c8fff', '#2dd4a0', '#f96b7e', '#fbbf24', '#a78bfa', '#38bdf8'],
};
```

### 2.5 Tailwind Config Extension

```ts
// tailwind.config.ts additions
extend: {
  colors: {
    bg: '#080d18',
    card: '#0f1523',
    border: '#1a2038',
    primary: '#6c8fff',
    success: '#2dd4a0',
    danger: '#f96b7e',
    warning: '#fbbf24',
    ink: '#dce8ff',
    muted: '#7a8fb0',
    sidebar: '#090e1d',
    ai: '#0e1830',
  },
  boxShadow: {
    card: '0 4px 24px rgba(0,0,0,0.45)',
    glow: '0 0 32px rgba(108,143,255,0.18)',
    'glow-success': '0 0 24px rgba(45,212,160,0.15)',
  },
}
```

---

## 3. AppShell Architecture

### 3.1 Layout Structure

Three-column adaptive layout:

```
┌────────────────────────────────────────────────────────────────┐
│                        TOPBAR (56px)                           │
├────────────┬───────────────────────────────────┬───────────────┤
│            │                                   │               │
│  SIDEBAR   │        MAIN CONTENT               │   AI PANEL    │
│  240px     │        flex-1, scrollable         │   280px       │
│  (or 48px  │                                   │   (toggleable)│
│   rail)    │                                   │               │
│            │                                   │               │
└────────────┴───────────────────────────────────┴───────────────┘
```

**Sidebar states:**
- Expanded: 240px, full labels + section headers visible
- Collapsed (icon rail): 48px, icons only, tooltips on hover

**AI Panel states:**
- Visible: 280px fixed right column
- Hidden: 0px (display:none), toggled by topbar button
- Default per route: visible on `/dashboard`, `/ai/*`; hidden elsewhere

**Persistence:** Both states stored in `localStorage` keys `portfolioai:sidebar-collapsed` and `portfolioai:ai-panel-open`.

**Mobile (< 768px):** Sidebar becomes a bottom-sheet drawer (triggered by hamburger in topbar). AI Panel is always hidden. Bottom nav tabs for Dashboard / Portfolio / Analytics / AI.

### 3.2 AppShell Component

**File:** `src/lib/components/portfolioai/AppShell.svelte`

Props:
```ts
export let showAiPanel: boolean = false; // per-route default
export let aiPanelContent: Snippet | null = null;
```

Internal state: `sidebarCollapsed` (localStorage), `aiPanelOpen` (localStorage, overridden by `showAiPanel` default on first visit to route).

Slots: `default` (main content), `aiPanel` (right panel content).

---

## 4. Sidebar

**File:** `src/lib/components/portfolioai/Sidebar.svelte`

### 4.1 Structure

```
◈ PortfolioAI  v0.x              ← logo + version (hidden in rail mode)
────────────────────────────────
  Dashboard                       ← top-level item, no group
────────────────────────────────
▶ Portfolio                       ← accordion group
    Overview
    Holdings
    Transactions
    Snapshots
    Accounts
    Watchlist
▶ Broker Sync
    Connections
    Moomoo              [READ ONLY badge]
    CSV Import
    Sync Logs
▶ Paper Trading        [SANDBOX badge on group header]
    Dashboard
    Positions
    Orders
    History
▶ Analytics
    Overview
    Portfolio Metrics
    Risk Analysis
    Exposure
    Diversification
    Benchmark
    Performance
    Attribution
    Income
▶ AI Workspace         [glows when AI active]
    AI Copilot
    AI Insights
    Conversations
    Prompt Explorer
    AI Memory
▶ Optimization         [COMING SOON]
▶ Multi-Agent AI       [COMING SOON]
▶ Quant Lab            [COMING SOON]
────────────────────────────────
  Settings                        ← pinned to bottom
```

### 4.2 Accordion Behavior

- One group open at a time (auto-close others on open, except if user manually expanded multiple — preserve multi-open state in localStorage).
- Active route's parent group auto-expands on navigation.
- Chevron icon rotates 90° when open (CSS transition).
- Sub-items: 32px height, 16px left indent from group icon.

### 4.3 Badge Types

| Badge | Style | Used on |
|---|---|---|
| `READ ONLY` | `--danger` text, transparent bg | Moomoo |
| `SANDBOX` | `--warning` text, amber tinted bg | Paper Trading group |
| `COMING SOON` | `--muted` text, italic | Optimization, Multi-Agent, Quant Lab |
| `LIVE` | `--success` text, green tinted bg | Live account indicator |

### 4.4 Icon Rail Mode

In 48px rail mode: show only the group icon. Tooltip on hover shows group name. Active group icon gets `--primary` colour and subtle glow ring. Sub-items not accessible — clicking the icon expands the sidebar to full mode.

### 4.5 Collapse Toggle

A `‹` / `›` toggle button fixed at the bottom of the sidebar (above Settings), full-width in expanded mode, centered icon in rail mode.

---

## 5. Topbar

**File:** `src/lib/components/portfolioai/Topbar.svelte`

**Style: Value-Hero · Contextual (Choice C)**

Left to right, items and their behaviour:

| Element | Notes |
|---|---|
| `◈` logomark | Collapses sidebar on click (same as sidebar toggle); hidden text in rail mode |
| Divider | 1px `--border` |
| **Portfolio Value Hero** | Two-line: `Total Portfolio` label (muted, 0.5rem) + `$142,830.42` (text, 1rem bold) + `+$1,204 today` (success, 0.65rem) |
| **Account Switcher** | Account name + `LIVE` / `SANDBOX` badge + `▾` chevron → dropdown with all accounts |
| Flex spacer | |
| `✦ Ask AI` | Glass button (ai-bg, ai-border, primary text); opens AI Copilot in modal or navigates to `/ai/copilot` |
| Notifications | Bell icon + red dot when unread; dropdown on click |
| User avatar | Initials circle; dropdown: Profile, Settings, Logout |
| Divider | |
| `⊞` | Sidebar toggle icon button |
| `✦` | AI Panel toggle icon button; glows `--primary` when panel is open |

**Account Switcher Dropdown:**
- Lists all user accounts with type badge (LIVE READ-ONLY / SANDBOX)
- Selecting an account reloads dashboard data for that account
- Selected account shown with checkmark

---

## 6. Dashboard Page

**Route:** `/dashboard`
**File:** `src/routes/dashboard/+page.svelte`
**AI Panel:** open by default

### 6.1 Page Header

```
Dashboard                         [Main Portfolio ▾]  [LIVE READ-ONLY]
Wednesday, 13 May 2026
```

### 6.2 AI Banner — Split Panel (Choice C)

Two-column card (`--ai-bg`, `--ai-border` border):

**Left column (60%):** `✦ AI BRIEF` label + 2–3 sentence AI portfolio summary fetched from the last AI insight or generated on load. Shows `--muted` text while loading (skeleton). Refresh icon to regenerate.

**Right column (40%):** `SUGGESTED QUESTIONS` label + 3 clickable chips:
- "Why is my portfolio risky?"
- "What sectors am I overweight?"
- "How does my portfolio compare to SPY?"

Clicking a chip navigates to `/ai/copilot` with the question pre-filled.

Loading state: skeleton lines on both sides.
Empty state (no AI data): "Generate your first AI brief →" CTA.

### 6.3 Stat Row — Glass/Glow Cards (Choice B)

4 cards in a responsive grid (`grid-cols-2 lg:grid-cols-4`):

| Card | Value | Tint Colour | Change |
|---|---|---|---|
| Portfolio Value | `$142,830.42` | `--primary` | `+1.2% today` |
| Day P&L | `+$1,204.30` | `--success` | `+0.85%` |
| Total Return | `+18.4%` | `--success` | `since inception` |
| Sharpe Ratio | `1.42` | `--primary` | `▲ Good` quality badge |

Each card: `background: linear-gradient(135deg, rgba(primary,0.08), rgba(card,0.6))`, `border: 1px solid rgba(primary,0.2)`. Value in semantic colour. Change indicator below value. No icon (cleaner for glass style).

### 6.4 Main Chart Grid

Two columns (`grid-cols-1 lg:grid-cols-3`):

**Left (2/3 width):** `PortfolioGrowthChart` — ECharts area line chart. Period toggle: `1M · 3M · 6M · 1Y · All`. Y-axis: portfolio value. Shows portfolio value history from `PortfolioSnapshot` data. Gradient fill under line (`--primary` → transparent).

**Right (1/3 width):** `AllocationChart` — ECharts donut chart. Sector/asset-type breakdown. Legend below with colour dots, label, and percentage. Click segment to drill into Exposure page.

### 6.5 AI Insight Cards Row

3 equal columns. Each is an `AiInsightCard`:

| Card | Icon | Content |
|---|---|---|
| Risk Signal | ⚠ | Volatility level, drawdown status, concentration warning |
| Allocation | ◉ | Overweight/underweight sectors, drift from target |
| Benchmark | ↗ | vs SPY/QQQ, alpha, rolling outperformance |

Card style: `--ai-bg` background, `--ai-border` border, `--primary` title, signal chip (green/amber/red), 2-line summary, "View Details →" link.

### 6.6 Bottom Row

Two columns (`grid-cols-1 lg:grid-cols-2`):

**Top Holdings table:** Symbol · Name · Market Value · Unrealized P&L · Allocation %. Max 8 rows. "View All →" link to `/holdings`.

**Watchlist:** Symbol · Price · Day Change · Note. Max 6 rows. "Manage →" link to `/watchlist`.

---

## 7. Portfolio Section Pages

### 7.1 Overview (`/portfolio`)

Mirrors the dashboard stat row + allocation chart + account breakdown cards. Acts as an entry point for the portfolio section. Breadcrumb: `Portfolio > Overview`.

### 7.2 Holdings (`/holdings`)

**`HoldingsTable` component:**
- Columns: Symbol | Name | Quantity | Avg Cost | Market Value | Unrealized P&L | % Change | Allocation | Account
- P&L and % Change colour-coded (`--success` / `--danger`)
- Sortable columns (click header)
- Search bar (filters by symbol or name)
- Account filter dropdown
- Export CSV button (top right)
- Loading: skeleton rows (8 rows)
- Empty state: "No holdings found. Import transactions or sync a broker."

### 7.3 Transactions (`/transactions`)

**`TransactionsTable` component:**
- Type filter chips: `All · Buy · Sell · Dividend · Fee · Transfer`
- Date range picker
- Columns: Date | Type | Symbol | Quantity | Price | Total | Account
- Type badges: Buy (success-tinted), Sell (danger-tinted), Dividend (primary-tinted), Fee (muted)
- Import CSV button
- Pagination (50 per page)

### 7.4 Accounts (`/accounts`)

Grid of `AccountCard` components (2 per row on desktop):
- Account name, broker label, type badge (`LIVE READ-ONLY` or `SANDBOX`)
- Balance (base currency), day P&L
- "Last synced: X ago" for broker accounts
- Edit / Delete actions (kebab menu)
- **No buy/sell buttons on LIVE accounts** — enforced in UI
- Add Account button (opens drawer form)

### 7.5 Watchlist (`/watchlist`)

Grid of symbol cards:
- Symbol + name, current price, day change (colour-coded)
- Conviction tag (user-set: Low / Medium / High)
- Note text (truncated, expand on click)
- Remove button (×)
- Add symbol form: symbol input + note + conviction select

### 7.6 Snapshots (`/snapshots`)

`SnapshotTable`:
- Columns: Date | Portfolio Value | Holdings Count | Cash | Actions
- Actions: View (opens snapshot detail drawer), Compare (select two to compare)
- Create Snapshot button (manual trigger)

---

## 8. Reusable Components

All components in `src/lib/components/portfolioai/` (new subfolder structure).

### 8.1 Core Shell
| Component | File | Notes |
|---|---|---|
| `AppShell` | `AppShell.svelte` | Replaces existing — same interface |
| `Sidebar` | `Sidebar.svelte` | Full rewrite |
| `Topbar` | `Topbar.svelte` | Full rewrite |
| `PageHeader` | `PageHeader.svelte` | Title + breadcrumb + account badge |
| `ContentGrid` | `ContentGrid.svelte` | Responsive grid wrapper |

### 8.2 Cards
| Component | Props | Notes |
|---|---|---|
| `StatCard` | `label, value, change, tint` | Glass variant |
| `InsightCard` | `title, summary, signal, type` | AI insight display |
| `AccountCard` | `account` (Prisma type) | Account display card |
| `BrokerCard` | `broker, status, lastSync` | Broker connection card |

### 8.3 Charts (ECharts wrappers)
| Component | Props | Notes |
|---|---|---|
| `PortfolioGrowthChart` | `snapshots[], period` | Area line chart |
| `AllocationChart` | `allocations[]` | Donut chart |

### 8.4 Tables
| Component | Props |
|---|---|
| `HoldingsTable` | `holdings[], loading` |
| `TransactionsTable` | `transactions[], loading` |
| `WatchlistTable` | `items[], loading` |
| `SnapshotTable` | `snapshots[], loading` |

### 8.5 AI Components
| Component | Notes |
|---|---|
| `AiBanner` | Split panel (brief + chips) |
| `AiInsightCard` | Risk/Allocation/Benchmark card |
| `AiSuggestionChips` | Clickable question chips |
| `AiCopilotChat` | Existing — restyled |
| `AiRiskBadge` | Low/Medium/High/Critical badge |
| `AiDisclaimerBox` | Advisory only disclaimer |

### 8.6 Badges & Utilities
| Component | Variants |
|---|---|
| `AccountModeBadge` | `LIVE READ-ONLY`, `SANDBOX`, `MANUAL` |
| `SyncStatusBadge` | `synced`, `syncing`, `error`, `never` |
| `ComingSoonBadge` | Muted italic overlay |
| `LoadingSkeleton` | `lines`, `card`, `table` variants |
| `EmptyState` | Icon + title + description + optional CTA |

---

## 9. Global CSS Changes

Replace `src/app.css` token block with Design B tokens. Utility class updates:

- `.card` → uses `--card` bg, `--border`, `--radius`, `--shadow`
- `.button` → `--primary` bg for primary; glass style for secondary
- `.button-secondary` → `--ai-bg` bg, `--ai-border`
- `.field` → `--card` bg, `--border`, `--text` colour
- `.positive` → `--success`
- `.negative` → `--danger`
- `.glass` → gradient + backdrop-filter (see §2.3)

---

## 10. Route Changes

No routes are added or removed. Only visual/layout changes:

| Route | Change |
|---|---|
| `+layout.svelte` | Updated AppShell with new sidebar/topbar |
| `dashboard/+page.svelte` | Full redesign per §6 |
| `holdings/+page.svelte` | New HoldingsTable component |
| `accounts/+page.svelte` | New AccountCard grid |
| `watchlist/+page.svelte` | New watchlist card grid |
| `transactions/+page.svelte` | New TransactionsTable with filter chips |
| `snapshots/+page.svelte` | New SnapshotTable |
| All other routes | Inherit new AppShell; internal content unchanged for now |

Existing `+page.server.ts` files are unchanged — data contracts are preserved.

---

## 11. What This Spec Does NOT Cover

The following are out of scope for this implementation phase. Each will get its own spec:

- Broker Sync pages (`/broker`)
- Paper Trading pages (`/paper-trading`)
- Analytics section (`/analytics/*`)
- AI Workspace section (`/ai/*`)
- Optimization, Multi-Agent, Quant Lab sections
- Settings page redesign
- Mobile bottom nav tabs
- Right AI Panel content and behaviour

---

## 12. Engineering Constraints

- **No real trading UI.** Live accounts show `READ ONLY` badge. No buy/sell buttons, no order forms on live accounts.
- **Paper trading only in sandbox.** Paper order form only rendered when account mode is `SANDBOX`.
- **AI is advisory only.** All AI components include `AiDisclaimerBox`. No autonomous actions.
- **No API keys in frontend.** All broker/AI calls via SvelteKit server routes.
- **Mock data allowed.** If an endpoint is not ready, components render with typed mock data and a `DEV` badge.
- **TypeScript strict.** All new components fully typed. No `any`.
- **ECharts only.** Remove ApexCharts dependency after migration.

---

## 13. Success Criteria

The implementation is complete when:

1. AppShell renders with adaptive sidebar (expand/collapse) and toggleable AI panel
2. Topbar shows portfolio value hero, account switcher, Ask AI button
3. Dashboard renders AI banner (split panel) + glass stat cards + growth chart + allocation donut + AI insight cards + holdings + watchlist
4. All Portfolio section pages (`/holdings`, `/transactions`, `/accounts`, `/watchlist`, `/snapshots`) use the new component library
5. Design tokens (Design B palette) applied globally via `app.css` and Tailwind config
6. No TypeScript errors (`svelte-check` passes)
7. Existing server-side data contracts unchanged
8. `READ ONLY` / `SANDBOX` badges enforced in all account-sensitive UI
