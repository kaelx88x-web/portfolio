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

| Icon | Section | Sub-pages | Route prefix |
|------|---------|-----------|--------------|
| 📊 | Dashboard | — (direct link) | `/dashboard` |
| 💼 | Portfolio | Holdings · Transactions · Watchlist · Accounts · Snapshots | `/holdings`, `/transactions`, `/watchlist`, `/accounts`, `/snapshots` |
| 📈 | Analytics | Benchmark · Risk · Performance · Metrics | `/analytics/*` |
| ✦ | AI Suite | Copilot · Risk Advisor · Portfolio Assistant · Memory · Insights | `/ai/*` |
| ⚡ | Optimize | Rebalance · Scenarios · Simulation · Stress Test | `/optimize/*` |
| 📅 | Income | Dividends · Cashflow | `/income/*` |
| 📋 | Trades | Orders · Paper Trading | `/trades/*` |
| 🔗 | Broker | Import · Fund Balance · Accounts | `/broker/*` |
| ⚙️ | Settings | — (direct link, bottom of rail) | `/settings` |

---

## Interaction Model

### Hybrid Trigger

| Action | Result |
|--------|--------|
| Hover rail icon | Fly-out appears after 150ms delay (not pinned) |
| Move mouse away | Fly-out closes after 200ms grace period |
| Click rail icon | Fly-out pins open; `pinnedSection` store updated |
| Click same icon again | Unpin + close fly-out |
| Click link in fly-out | Navigate; close fly-out if not pinned |
| Click outside fly-out | Unpin + close |
| Press `Escape` | Unpin + close |

### Active State

- `$page.url.pathname` determines which rail icon is highlighted
- Active icon: coloured left-border indicator + coloured icon
  - Default sections: blue (`#58a6ff`) left border
  - AI section: green (`#3fb950`) left border (special brand colour)
- Active link inside fly-out: highlighted row

### Pin Persistence

`pinnedSection` is stored in a Svelte writable store (not localStorage — it resets on page reload, which is fine).

---

## Component Architecture

### New/Modified Files

| File | Change | Responsibility |
|------|--------|---------------|
| `src/lib/config/nav.ts` | **Create** | Single source of truth for all sections and sub-page definitions |
| `src/lib/stores/nav.ts` | **Create** | `pinnedSection` writable store |
| `src/lib/components/portfolioai/Sidebar.svelte` | **Rewrite** | Icon rail only (48px). Imports nav config, renders rail items, manages hover/pin state |
| `src/lib/components/nav/NavFlyout.svelte` | **Create** | Fly-out panel. Receives `section` prop, renders sub-page links, handles `clickOutside` |
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
  href?: string;       // set for direct-link sections (Dashboard, Settings)
  color?: string;      // override accent colour (AI section uses green)
  children?: NavSubPage[];
}

export const NAV_SECTIONS: NavSection[] = [ ... ];
```

### `Sidebar.svelte` Responsibilities

- Render 48px rail with one `rail-item` per section
- Track `hoveredSection: string | null` (local state)
- Read `$pinnedSection` store
- On hover: set `hoveredSection`, show `NavFlyout`
- On click: toggle `$pinnedSection`
- Pass `isOpen`, `section`, `isPinned`, `on:close` to `NavFlyout`

### `NavFlyout.svelte` Responsibilities

- Receive `section: NavSection` and `isPinned: boolean`
- Render section header + sub-page links
- Use `clickOutside` Svelte action to emit `close` event
- Svelte `fly` transition: `{ x: -8, duration: 150, easing: cubicOut }`
- When `isPinned`: render inline (part of normal flow)
- When not pinned: render `position: absolute`, `z-index: 50`

---

## Mobile (≤768px)

- Rail + fly-out hidden
- Bottom tab bar replaces rail: 5 tabs — Dashboard, Portfolio, AI, Optimize, Trades
- Tap = direct navigation (no fly-out)
- Implemented via CSS media query in layout

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
- Fly-out opens on hover, pins on click, closes on click-outside / Escape
- Active section highlighted correctly on every page
- Mobile bottom tab bar visible on ≤768px
- No existing routes broken

---

## Out of Scope

- Adding new pages (that comes after nav fix)
- Changing page content or route structure
- Persistent pin state across sessions (localStorage) — not needed for MVP
