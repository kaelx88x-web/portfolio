# Navigation Restructure Design

**Date:** 2026-05-25  
**Status:** Approved  
**Goal:** Replace the current accordion sidebar with an icon rail + fly-out panel, making all 60+ routes accessible.

---

## Problem

The current sidebar exposes only ~15 of the app's 60+ pages. The AI section (15+ pages, the app's biggest differentiator) is unreachable except via a single "Ask AI" topbar button. Users cannot discover most features.

---

## Solution

**Option B — Icon Rail + Fly-out Panel** (VS Code / Figma style)

A 48px icon rail is always visible on the left. Hovering a rail icon previews a 200px fly-out panel with that section's sub-pages. Clicking the icon pins the fly-out open, pushing main content rightward. Clicking outside or pressing Escape unpins it.

---

## Layout

```
┌──────────────────────────────────────────────────────┐
│  48px rail  │  200px fly-out (hover/pinned)  │  main  │
│             │                                │        │
│  📊         │  ✦ AI Suite                   │        │
│  💼         │  ─────────────                │        │
│  📈         │  💬 Copilot      ← active     │  page  │
│  ✦ ←active │  🛡️ Risk Advisor              │        │
│  ⚡         │  🧠 Portfolio Asst            │        │
│  📅         │  🗂️ Memory                   │        │
│  📋         │  💡 Insights                  │        │
│  🔗         │                                │        │
│  ─────────  │                                │        │
│  ⚙️         │                                │        │
└──────────────────────────────────────────────────────┘
```

**Unpinned:** fly-out `position: absolute`, overlays content.  
**Pinned:** fly-out becomes part of the normal flow, main content `margin-left` becomes 248px.  
**Normal:** main content `margin-left: 48px`.

---

## Navigation Sections

| Icon | Section | Sub-pages | Route matching |
|------|---------|-----------|----------------|
| 📊 | Dashboard | — (direct link) | exact `/dashboard` |
| 💼 | Portfolio | Holdings · Transactions · Watchlist · Accounts · Snapshots | exact array: `/holdings`, `/transactions`, `/watchlist`, `/accounts`, `/snapshots` |
| 📈 | Analytics | Benchmark · Risk · Performance · Metrics | startsWith `/analytics` |
| ✦ | AI Suite | Copilot · Risk Advisor · Portfolio Assistant · Memory · Insights | startsWith `/ai` |
| ⚡ | Optimize | Rebalance · Scenarios · Simulation · Stress Test | startsWith `/optimize` |
| 📅 | Income | Dividends · Cashflow | startsWith `/income` |
| 📋 | Trades | Orders · Paper Trading | startsWith `/trades` |
| 🔗 | Broker | Import · Fund Balance · Accounts | startsWith `/broker` |
| ⚙️ | Settings | — (direct link, bottom of rail) | exact `/settings` |

---

## Interaction Model

### Trigger by Viewport

| Viewport | Trigger |
|----------|---------|
| >1024px (desktop) | **Hybrid:** hover to preview (150ms delay), click to pin |
| 769–1024px (tablet) | **Click-only:** no hover; click to open/pin |
| ≤768px (mobile) | Bottom tab bar — no rail, no fly-out |

### Hybrid Trigger (desktop)

| Action | Result |
|--------|--------|
| Hover rail icon (section with children) | Fly-out appears after 150ms delay (not pinned) |
| Move mouse away from rail or fly-out | Fly-out closes after 200ms grace period |
| Mouse moves diagonally from rail to fly-out | 200ms grace period prevents close during diagonal travel |
| Hover rail icon (Dashboard or Settings) | Tooltip with section name — no fly-out |
| Click rail icon (section with children) | Fly-out pins open; `pinnedSection` store updated |
| Click same icon again while pinned | Unpin + close fly-out |
| Click sub-page link while **pinned** | Navigate; fly-out **stays open** (pin persists) |
| Click sub-page link while **not pinned** | Navigate; fly-out closes |
| Click outside fly-out (excluding rail) | Unpin + close |
| Press `Escape` | Unpin + close |
| Click Dashboard or Settings icon | Navigate directly |

### Active State & Pathname Matching

- `$page.url.pathname` determines which rail icon is highlighted
- Sections with a prefix (AI, Analytics, Optimize, Income, Trades, Broker): use `pathname.startsWith(prefix)`
- Sections with root-level routes (Portfolio): match against explicit array of paths
- Direct-link sections (Dashboard, Settings): exact match
- Active icon style: coloured left-border indicator + coloured icon
  - Default sections: blue (`#58a6ff`) left border
  - AI section: green (`#3fb950`) left border (special brand colour)
- Active link inside fly-out: highlighted row

### Pin Persistence

`pinnedSection` is a Svelte writable store (memory only — resets on page reload, which is intentional). Clicking sub-pages while pinned does not unpin.

---

## Z-index Hierarchy

| Layer | z-index |
|-------|---------|
| Icon rail | 30 |
| Fly-out (unpinned) | 40 |
| Topbar | 50 |
| Topbar dropdowns | 60 |
| Modals / overlays | 100 |

Fly-out (z-index 40) sits below topbar (z-index 50) — topbar dropdowns always win.

---

## Component Architecture

### New/Modified Files

| File | Change | Responsibility |
|------|--------|---------------|
| `src/lib/config/nav.ts` | **Create** | Single source of truth for all sections and sub-page definitions |
| `src/lib/actions/clickOutside.ts` | **Create** | Svelte action: fires `outclick` event when click is outside element, with `exclude` element support |
| `src/lib/stores/nav.ts` | **Create** | `pinnedSection` writable store |
| `src/lib/components/portfolioai/Sidebar.svelte` | **Rewrite** | Icon rail (48px). Renders rail items, manages hover/pin state, shows tooltips for direct-link sections |
| `src/lib/components/nav/NavFlyout.svelte` | **Create** | Fly-out panel. Receives `section` prop, renders sub-page links, uses `clickOutside` with rail excluded |
| `src/lib/components/nav/NavBottomBar.svelte` | **Create** | Mobile bottom tab bar (5 tabs, visible ≤768px) |
| `src/routes/+layout.svelte` | **Modify** | Adjust main content left margin reactively based on pinned state |

### `nav.ts` Shape

```ts
export interface NavSubPage {
  label: string;
  href: string;
  icon: string;
  badge?: string; // e.g. "New"
}

export interface NavSection {
  id: string;
  icon: string;
  label: string;
  href?: string;           // set for direct-link sections (Dashboard, Settings)
  color?: string;          // override accent colour (AI section: '#3fb950')
  matchPrefix?: string;    // startsWith match, e.g. '/ai'
  matchPaths?: string[];   // exact path array for root-level routes (Portfolio)
  children?: NavSubPage[];
}

export const NAV_SECTIONS: NavSection[] = [ ... ];
```

### `clickOutside.ts` Action

```ts
// Usage: <div use:clickOutside={{ exclude: railEl }} on:outclick={close}>
export function clickOutside(
  node: HTMLElement,
  options: { exclude?: HTMLElement | null }
) { ... }
```

Fires a custom `outclick` event when a click lands outside `node` AND outside `options.exclude`. This prevents the rail icon click from simultaneously triggering close + reopen flicker.

### `Sidebar.svelte` Responsibilities

- Render 48px rail with one `rail-item` per section
- Expose `railEl` binding (passed to `NavFlyout` as `clickOutside` exclude target)
- Track `hoveredSection: string | null` and hover/grace timers (local state)
- On desktop (>1024px): 150ms hover delay before showing fly-out; 200ms grace on mouse-leave
- On tablet (769–1024px): no hover timers; click-only open
- On click: toggle `$pinnedSection`
- For Dashboard/Settings: show tooltip on hover; navigate on click
- Pass `isOpen`, `section`, `isPinned`, `railEl`, `on:close` to `NavFlyout`

### `NavFlyout.svelte` Responsibilities

- Receive `section: NavSection`, `isPinned: boolean`, `railEl: HTMLElement`
- Render section header + sub-page links
- Use `clickOutside` action with `exclude: railEl`
- Svelte `fly` transition: `{ x: -8, duration: 150, easing: cubicOut }`
- When `isPinned`: `position: static`, part of normal layout flow
- When not pinned: `position: absolute`, `z-index: 40`
- `aria-label` on section nav, links are standard `<a>` tags (Tab-navigable by default)

### `NavBottomBar.svelte` Responsibilities

- Visible only on ≤768px (CSS `display: none` above breakpoint)
- 5 fixed tabs: Dashboard, Portfolio, AI, Optimize, Trades
- Active tab derived from `$page.url.pathname`
- Standard `<a>` links — no fly-out on mobile

---

## Accessibility (MVP)

- Rail icons: `aria-label="[Section name]"`, `role="button"` where applicable
- Fly-out nav: `role="navigation"`, `aria-label="[Section name] navigation"`
- Sub-page links: standard `<a>` — keyboard Tab-navigable by default
- `Escape` closes fly-out ✅
- Arrow keys + focus trap: post-MVP

---

## Mobile (≤768px)

- Rail + fly-out: `display: none`
- `NavBottomBar` shown: fixed bottom, 5 icon+label tabs
- Tap = direct navigation (no fly-out)
- Implemented via CSS media query, no JS breakpoint detection needed

---

## What This Does NOT Change

- Route files — no routes are moved or renamed
- Topbar — kept as-is (search, notifications, user menu)
- Page content — no page internals are touched
- Dark mode — existing CSS variables used throughout

---

## Success Criteria

- All 8 sections + Settings reachable from sidebar
- AI section (5 sub-pages) fully visible and navigable
- Fly-out opens on hover (desktop), click (tablet), pins on click, closes on click-outside / Escape
- Pinned fly-out stays open when navigating sub-pages
- Active section highlighted correctly on every page (startsWith + exact array logic)
- Dashboard/Settings show tooltip on hover, navigate on click
- Topbar dropdowns (z-index 60) always render above fly-out (z-index 40)
- Mobile bottom tab bar visible on ≤768px
- No existing routes broken

---

## Out of Scope

- Adding new pages (that comes after nav fix)
- Changing page content or route structure
- Persistent pin state across sessions (localStorage) — not needed for MVP
- Arrow key navigation within fly-out (post-MVP WCAG enhancement)
- Triangle-based diagonal mouse hit detection (200ms grace period is sufficient for MVP)
