# PortfolioAI Multi-Theme System — Design Spec

**Date:** 2026-05-10  
**Project:** `doc/portfolioai` (React + Vite + Tailwind CSS v4)  
**Status:** Approved

---

## Overview

Extend the existing two-state dark/light theme toggle into a full six-theme system. Themes are applied via a CSS class on `<html>`, persisted to `localStorage`, and switched via a new `ThemeDropdown` component that replaces the current sun/moon button in the app header.

---

## Themes

| Name | Type | Background | Surface | Surface Light | Accent |
|------|------|-----------|---------|---------------|--------|
| Midnight | Dark | `#0a0b14` | `#111420` | `#1c2131` | `#00f2fe` (cyan) |
| Aurora | Dark | `#0d0a1e` | `#150e2e` | `#1f1545` | `#a855f7` (violet) |
| Ember | Dark | `#150b05` | `#1e1008` | `#2d1810` | `#f97316` (orange) |
| Forest | Dark | `#050f08` | `#0a1a0e` | `#122518` | `#84cc16` (lime) |
| Arctic | Light | `#f0f9ff` | `#ffffff` | `#e0f2fe` | `#0d9488` (teal) |
| Rose | Light | `#fff1f2` | `#ffffff` | `#ffe4e6` | `#e11d48` (red) |

---

## Architecture

### Approach

CSS class on `<html>` (extends the existing pattern). Each theme maps to a class: `theme-midnight`, `theme-aurora`, etc. All custom properties are defined under each class selector.

### Why this approach

- Matches the existing dark/light pattern (`document.documentElement.classList`)
- Zero structural changes to Tailwind v4's `@theme` block (already uses `var()` references)
- 6 theme blocks in `index.css` is fully manageable

---

## CSS Layer (`src/index.css`)

### Variable Contract

Every theme block defines these 8 properties:

```css
--brand-color          /* accent: buttons, highlights, glows */
--bg-color             /* page background */
--surface-color        /* card / panel background */
--surface-color-light  /* inputs, secondary panels */
--text-primary         /* main text */
--text-secondary       /* muted / label text */
--border-color         /* borders and dividers */
--glass-bg             /* semi-transparent glass surface */
```

### Changes to existing CSS

- Remove `:root { ... }` (default dark values) → becomes `.theme-midnight { ... }`
- Remove `:root.light { ... }` → becomes `.theme-arctic { ... }`
- Add four new blocks: `.theme-aurora`, `.theme-ember`, `.theme-forest`, `.theme-rose`
- `@theme` block at top of file: **no changes needed**
- `btn-primary` box-shadow: change hardcoded `rgba(0, 242, 254, 0.2)` to `rgba(from var(--brand-color) r g b / 0.2)` so the glow follows the active accent

### Light theme text adjustments

Arctic and Rose use dark text on light backgrounds. Their blocks set:
- `--text-primary` to a dark navy (e.g. `#0f172a`)
- `--text-secondary` to a dark slate (e.g. `#334155`)
- `--border-color` to a subtle dark-on-light value
- `--glass-bg` to a semi-transparent white

---

## State & Persistence (`src/App.tsx`)

### Type

```ts
type Theme = 'midnight' | 'aurora' | 'ember' | 'forest' | 'arctic' | 'rose'
const LIGHT_THEMES: Theme[] = ['arctic', 'rose']
```

### Initialization

```ts
const [theme, setTheme] = useState<Theme>(
  () => (localStorage.getItem('theme') as Theme) ?? 'midnight'
)
```

### Effect

```ts
useEffect(() => {
  const root = document.documentElement
  root.classList.remove('theme-midnight','theme-aurora','theme-ember','theme-forest','theme-arctic','theme-rose')
  root.classList.add(`theme-${theme}`)
  localStorage.setItem('theme', theme)
}, [theme])
```

### TradingView theme prop

Components that pass a `theme` prop to `TradingViewChart` currently check `theme === 'light'`. Update to:

```ts
LIGHT_THEMES.includes(theme) ? 'light' : 'dark'
```

Affected: `Dashboard`, `WatchlistPage`, `ComparisonDashboard`.

---

## ThemeDropdown Component (`src/components/ThemeDropdown.tsx`)

New self-contained component. Props: `theme: Theme`, `setTheme: (t: Theme) => void`.

### Behaviour

- Renders a button showing an accent-colored dot + current theme name + chevron
- Click toggles open/closed state
- Closes on outside click via `useRef` + `document` event listener
- Themes grouped: Dark (Midnight, Aurora, Ember, Forest) above a divider, Light (Arctic, Rose) below
- Active theme displays a checkmark in the accent color

### Placement

Replaces the existing `<button onClick={() => setTheme(...)}><Sun/><Moon/></button>` in `AppShell`'s header right section. `AppShell` receives `theme` and `setTheme` props (already does today).

---

## Files Changed

| File | Change |
|------|--------|
| `src/index.css` | Replace 2 theme blocks with 6; fix `btn-primary` glow |
| `src/App.tsx` | Update `Theme` type, init from localStorage, update effect, update light-theme check in 3 places |
| `src/components/ThemeDropdown.tsx` | New component |

---

## Out of Scope

- Per-component theme overrides
- System preference detection (`prefers-color-scheme`)
- Theme transitions/animations beyond the existing `transition: background-color 0.3s ease` on `body`
