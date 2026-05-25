# Navigation Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the accordion sidebar with a 48px icon rail + fly-out panel, making all 60+ routes accessible.

**Architecture:** A permanent 48px icon rail lives in `AppShell.svelte`'s `shell-body`. Hovering a rail icon (desktop) or clicking it (tablet) shows a `NavFlyout` component rendered as a sibling in `shell-body` — floating (absolute) when hovered, inline (static, pushes content) when pinned. Three stores coordinate state: `pinnedSection`, `hoveredSection`, `flyoutActive`. Mobile gets a `NavBottomBar` replacing the sidebar drawer.

**Tech Stack:** SvelteKit, Svelte 4, TypeScript, Vitest (jsdom), svelte/transition fly, svelte/easing cubicOut

**Spec:** `docs/superpowers/specs/2026-05-25-nav-restructure-design.md`

---

## File Map

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/config/nav.ts` | Create | Nav section + sub-page definitions; `getActiveSectionId()` |
| `src/lib/config/nav.test.ts` | Create | Unit tests for nav config logic |
| `src/lib/actions/clickOutside.ts` | Create | Svelte action — fires `outclick` when clicking outside, with `exclude` support |
| `src/lib/actions/clickOutside.test.ts` | Create | Unit tests for clickOutside action |
| `src/lib/stores/nav.ts` | Create | `pinnedSection`, `hoveredSection`, `flyoutActive` writables |
| `src/lib/components/nav/NavFlyout.svelte` | Create | Fly-out panel — float or pinned, reads/writes stores |
| `src/lib/components/nav/NavBottomBar.svelte` | Create | Mobile bottom tab bar (5 tabs, ≤768px) |
| `src/lib/components/portfolioai/Sidebar.svelte` | Rewrite | Icon rail — 48px, hover/pin logic, writes to stores |
| `src/lib/components/portfolioai/AppShell.svelte` | Modify | Layout: always-48px sidebar, flyout container, z-index fixes, mobile bottom bar |
| `vite.config.ts` | Modify | Add Vitest config block |

---

### Task 1: Vitest setup + nav config

**Files:**
- Modify: `vite.config.ts`
- Create: `src/lib/config/nav.ts`
- Create: `src/lib/config/nav.test.ts`

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest jsdom
```

- [ ] **Step 2: Add Vitest config to vite.config.ts**

Replace the entire file:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Run Vitest to verify setup (no tests yet)**

```bash
npx vitest run
```

Expected: "No test files found" or 0 tests, exit 0.

- [ ] **Step 4: Create `src/lib/config/nav.ts`**

```ts
// src/lib/config/nav.ts

export interface NavSubPage {
  label: string;
  href: string;
  icon: string;
  badge?: string;
}

export interface NavSection {
  id: string;
  icon: string;
  label: string;
  href?: string;         // direct-link sections (Dashboard, Settings) — no fly-out
  color?: string;        // accent colour override (AI section: '#3fb950')
  matchPrefix?: string;  // pathname.startsWith(matchPrefix) → this section is active
  matchPaths?: string[]; // exact pathname matches → this section is active
  children?: NavSubPage[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'dashboard',
    icon: '📊',
    label: 'Dashboard',
    href: '/dashboard',
    matchPaths: ['/dashboard', '/'],
  },
  {
    id: 'portfolio',
    icon: '💼',
    label: 'Portfolio',
    matchPaths: ['/holdings', '/transactions', '/accounts', '/watchlist', '/snapshots'],
    children: [
      { label: 'Holdings',     href: '/holdings',     icon: '📋' },
      { label: 'Transactions', href: '/transactions', icon: '💱' },
      { label: 'Watchlist',    href: '/watchlist',    icon: '👁️' },
      { label: 'Accounts',     href: '/accounts',     icon: '🏦' },
      { label: 'Snapshots',    href: '/snapshots',    icon: '📸' },
    ],
  },
  {
    id: 'analytics',
    icon: '📈',
    label: 'Analytics',
    matchPrefix: '/analytics',
    children: [
      { label: 'Overview',        href: '/analytics',                 icon: '📊' },
      { label: 'Benchmark',       href: '/analytics/benchmark',       icon: '🏁' },
      { label: 'Risk',            href: '/analytics/risk',            icon: '⚠️' },
      { label: 'Performance',     href: '/analytics/performance',     icon: '📈' },
      { label: 'Diversification', href: '/analytics/diversification', icon: '🥧' },
      { label: 'Exposure',        href: '/analytics/exposure',        icon: '🎯' },
    ],
  },
  {
    id: 'ai',
    icon: '✦',
    label: 'AI Suite',
    color: '#3fb950',
    matchPrefix: '/ai',
    children: [
      { label: 'Copilot',             href: '/ai/copilot',             icon: '💬' },
      { label: 'Risk Advisor',        href: '/ai/risk-advisor',        icon: '🛡️' },
      { label: 'Portfolio Assistant', href: '/ai/portfolio-assistant', icon: '🧠' },
      { label: 'Memory',              href: '/ai/memory',              icon: '🗂️', badge: 'New' },
      { label: 'Insights',            href: '/ai/insights',            icon: '💡' },
    ],
  },
  {
    id: 'optimize',
    icon: '⚡',
    label: 'Optimize',
    matchPrefix: '/optimization',
    children: [
      { label: 'Rebalance',   href: '/optimization/rebalance',   icon: '⚖️' },
      { label: 'Scenarios',   href: '/optimization/scenarios',   icon: '🎭' },
      { label: 'Simulation',  href: '/optimization/simulation',  icon: '🔮' },
      { label: 'Stress Test', href: '/optimization/stress-test', icon: '💥' },
    ],
  },
  {
    id: 'income',
    icon: '📅',
    label: 'Income',
    matchPaths: ['/cashflow', '/dividend-planner'],
    children: [
      { label: 'Cashflow',  href: '/cashflow',          icon: '💰' },
      { label: 'Dividends', href: '/dividend-planner',  icon: '📅' },
    ],
  },
  {
    id: 'trades',
    icon: '📋',
    label: 'Trades',
    matchPrefix: '/trades',
    matchPaths: ['/orders', '/paper-trading'],
    children: [
      { label: 'Overview',      href: '/trades',        icon: '📋' },
      { label: 'Orders',        href: '/orders',        icon: '📝' },
      { label: 'Paper Trading', href: '/paper-trading', icon: '🧪' },
    ],
  },
  {
    id: 'broker',
    icon: '🔗',
    label: 'Broker',
    matchPaths: ['/broker', '/fund-balance', '/import'],
    children: [
      { label: 'Connections',  href: '/broker',       icon: '🔗' },
      { label: 'Fund Balance', href: '/fund-balance', icon: '💳' },
      { label: 'Import',       href: '/import',       icon: '📥' },
    ],
  },
  {
    id: 'settings',
    icon: '⚙️',
    label: 'Settings',
    href: '/settings',
    matchPrefix: '/settings',
  },
];

/**
 * Returns the section id whose route matches the given pathname.
 * matchPaths checked first (exact), then matchPrefix (startsWith).
 */
export function getActiveSectionId(pathname: string): string | null {
  for (const section of NAV_SECTIONS) {
    if (section.matchPaths?.includes(pathname)) return section.id;
    if (section.matchPrefix && pathname.startsWith(section.matchPrefix)) return section.id;
    if (section.href && pathname === section.href) return section.id;
  }
  return null;
}
```

- [ ] **Step 5: Write failing tests in `src/lib/config/nav.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { NAV_SECTIONS, getActiveSectionId } from './nav';

describe('NAV_SECTIONS', () => {
  it('has 9 sections', () => {
    expect(NAV_SECTIONS).toHaveLength(9);
  });

  it('dashboard has no children', () => {
    const d = NAV_SECTIONS.find(s => s.id === 'dashboard')!;
    expect(d.children).toBeUndefined();
    expect(d.href).toBe('/dashboard');
  });

  it('ai section has green colour', () => {
    const ai = NAV_SECTIONS.find(s => s.id === 'ai')!;
    expect(ai.color).toBe('#3fb950');
  });

  it('all sections with children have at least 2 sub-pages', () => {
    for (const s of NAV_SECTIONS) {
      if (s.children) expect(s.children.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('getActiveSectionId', () => {
  it('matches dashboard exact path', () => {
    expect(getActiveSectionId('/dashboard')).toBe('dashboard');
  });

  it('matches root / to dashboard', () => {
    expect(getActiveSectionId('/')).toBe('dashboard');
  });

  it('matches ai sub-path via prefix', () => {
    expect(getActiveSectionId('/ai/copilot')).toBe('ai');
    expect(getActiveSectionId('/ai/memory')).toBe('ai');
  });

  it('matches portfolio root-level paths exactly', () => {
    expect(getActiveSectionId('/holdings')).toBe('portfolio');
    expect(getActiveSectionId('/transactions')).toBe('portfolio');
    expect(getActiveSectionId('/watchlist')).toBe('portfolio');
  });

  it('matches optimization prefix routes', () => {
    expect(getActiveSectionId('/optimization/rebalance')).toBe('optimize');
    expect(getActiveSectionId('/optimization/stress-test')).toBe('optimize');
  });

  it('matches trades mix of prefix and exact paths', () => {
    expect(getActiveSectionId('/trades')).toBe('trades');
    expect(getActiveSectionId('/trades/tickets')).toBe('trades');
    expect(getActiveSectionId('/orders')).toBe('trades');
    expect(getActiveSectionId('/paper-trading')).toBe('trades');
  });

  it('returns null for unknown paths', () => {
    expect(getActiveSectionId('/unknown')).toBeNull();
  });
});
```

- [ ] **Step 6: Run tests — expect FAIL (nav.ts not yet created)**

```bash
npx vitest run src/lib/config/nav.test.ts
```

Expected: Tests run and pass (file was created in Step 4). If they fail, re-check nav.ts.

- [ ] **Step 7: Confirm all tests pass**

```bash
npx vitest run
```

Expected: All tests PASS, no failures.

- [ ] **Step 8: Commit**

```bash
git add vite.config.ts src/lib/config/nav.ts src/lib/config/nav.test.ts package.json package-lock.json
git commit -m "feat: add nav config with getActiveSectionId + vitest setup"
```

---

### Task 2: clickOutside Svelte action

**Files:**
- Create: `src/lib/actions/clickOutside.ts`
- Create: `src/lib/actions/clickOutside.test.ts`

- [ ] **Step 1: Create `src/lib/actions/clickOutside.ts`**

```ts
// src/lib/actions/clickOutside.ts
// Svelte action that fires a custom 'outclick' event when a click lands
// outside the node AND outside an optional exclude element.
// Uses capture phase to fire before other click handlers (prevents
// rail icon click from simultaneously triggering close + reopen).

export interface ClickOutsideOptions {
  exclude?: HTMLElement | null | undefined;
}

export function clickOutside(node: HTMLElement, options: ClickOutsideOptions = {}) {
  let currentOptions = options;

  function handleClick(event: MouseEvent) {
    const target = event.target as Node | null;
    if (!target) return;
    if (node.contains(target)) return;
    if (currentOptions.exclude && currentOptions.exclude.contains(target)) return;
    node.dispatchEvent(new CustomEvent('outclick'));
  }

  document.addEventListener('click', handleClick, true);

  return {
    update(newOptions: ClickOutsideOptions) {
      currentOptions = newOptions;
    },
    destroy() {
      document.removeEventListener('click', handleClick, true);
    },
  };
}
```

- [ ] **Step 2: Write failing tests in `src/lib/actions/clickOutside.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clickOutside } from './clickOutside';

function makeDiv(): HTMLDivElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function click(target: HTMLElement) {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('clickOutside action', () => {
  let node: HTMLDivElement;
  let outsideEl: HTMLDivElement;
  let excludeEl: HTMLDivElement;
  let handler: ReturnType<typeof vi.fn>;
  let cleanup: () => void;

  beforeEach(() => {
    node = makeDiv();
    outsideEl = makeDiv();
    excludeEl = makeDiv();
    handler = vi.fn();
    node.addEventListener('outclick', handler);
    const action = clickOutside(node, {});
    cleanup = action.destroy;
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('fires outclick when clicking outside the node', () => {
    click(outsideEl);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire outclick when clicking inside the node', () => {
    click(node);
    expect(handler).not.toHaveBeenCalled();
  });

  it('does NOT fire outclick when clicking on excluded element', () => {
    cleanup();
    const action = clickOutside(node, { exclude: excludeEl });
    cleanup = action.destroy;
    click(excludeEl);
    expect(handler).not.toHaveBeenCalled();
  });

  it('updates exclude target via update()', () => {
    const action = clickOutside(node, {});
    action.update({ exclude: outsideEl });
    click(outsideEl);
    expect(handler).not.toHaveBeenCalled();
    action.destroy();
  });

  it('stops listening after destroy()', () => {
    cleanup();
    click(outsideEl);
    expect(handler).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run src/lib/actions/clickOutside.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/clickOutside.ts src/lib/actions/clickOutside.test.ts
git commit -m "feat: add clickOutside Svelte action with exclude support"
```

---

### Task 3: Nav stores

**Files:**
- Create: `src/lib/stores/nav.ts`

- [ ] **Step 1: Create `src/lib/stores/nav.ts`**

```ts
// src/lib/stores/nav.ts
import { writable } from 'svelte/store';

/** ID of the section whose fly-out is pinned open (persists during navigation within section). */
export const pinnedSection = writable<string | null>(null);

/** ID of the section currently being hovered on the rail (not pinned). */
export const hoveredSection = writable<string | null>(null);

/** True while the mouse is inside the fly-out panel (used to cancel close timer). */
export const flyoutActive = writable<boolean>(false);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -5
```

Expected: 0 errors (or same errors as before — none from new file).

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/nav.ts
git commit -m "feat: add nav stores (pinnedSection, hoveredSection, flyoutActive)"
```

---

### Task 4: NavFlyout component

**Files:**
- Create: `src/lib/components/nav/NavFlyout.svelte`

- [ ] **Step 1: Create `src/lib/components/nav/NavFlyout.svelte`**

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { page } from '$app/stores';
  import { clickOutside } from '$lib/actions/clickOutside';
  import { flyoutActive } from '$lib/stores/nav';
  import type { NavSection } from '$lib/config/nav';

  export let section: NavSection;
  export let isPinned: boolean = false;
  export let railEl: HTMLElement | undefined = undefined;

  const dispatch = createEventDispatcher<{ close: void }>();

  $: activePath = $page.url.pathname;
  $: accentColor = section.color ?? 'var(--primary)';
  $: accentBg = section.color
    ? `${section.color}18`
    : 'rgba(var(--primary-rgb), 0.1)';

  function handleLinkClick() {
    if (!isPinned) dispatch('close');
  }

  function handleOutclick() {
    dispatch('close');
  }

  function onMouseEnter() {
    flyoutActive.set(true);
  }

  function onMouseLeave() {
    flyoutActive.set(false);
    if (!isPinned) dispatch('close');
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') dispatch('close');
  }
</script>

<!-- Float mode: absolute position, transitions in/out -->
<!-- Pinned mode: static, no transition needed (parent handles layout) -->
{#if !isPinned}
  <nav
    class="flyout"
    aria-label="{section.label} navigation"
    transition:fly={{ x: -8, duration: 150, easing: cubicOut }}
    use:clickOutside={{ exclude: railEl }}
    on:outclick={handleOutclick}
    on:mouseenter={onMouseEnter}
    on:mouseleave={onMouseLeave}
    on:keydown={onKeydown}
  >
    <div class="flyout-header" style="color: {accentColor}">
      <span class="flyout-icon">{section.icon}</span>
      <div>
        <div class="flyout-title">{section.label}</div>
        {#if section.children}
          <div class="flyout-subtitle">{section.children.length} pages</div>
        {/if}
      </div>
    </div>
    {#if section.children}
      {#each section.children as child}
        {@const isActive = activePath === child.href || activePath.startsWith(child.href + '/')}
        <a
          href={child.href}
          class="flyout-link"
          class:active={isActive}
          style={isActive ? `color: ${accentColor}; background: ${accentBg}` : ''}
          on:click={handleLinkClick}
        >
          <span class="flyout-link-icon">{child.icon}</span>
          <span class="flyout-link-label">{child.label}</span>
          {#if child.badge}
            <span class="flyout-badge">{child.badge}</span>
          {/if}
        </a>
      {/each}
    {/if}
  </nav>
{:else}
  <nav
    class="flyout flyout-pinned"
    aria-label="{section.label} navigation"
    use:clickOutside={{ exclude: railEl }}
    on:outclick={handleOutclick}
    on:keydown={onKeydown}
  >
    <div class="flyout-header" style="color: {accentColor}">
      <span class="flyout-icon">{section.icon}</span>
      <div>
        <div class="flyout-title">{section.label}</div>
        {#if section.children}
          <div class="flyout-subtitle">{section.children.length} pages</div>
        {/if}
      </div>
    </div>
    {#if section.children}
      {#each section.children as child}
        {@const isActive = activePath === child.href || activePath.startsWith(child.href + '/')}
        <a
          href={child.href}
          class="flyout-link"
          class:active={isActive}
          style={isActive ? `color: ${accentColor}; background: ${accentBg}` : ''}
          on:click={handleLinkClick}
        >
          <span class="flyout-link-icon">{child.icon}</span>
          <span class="flyout-link-label">{child.label}</span>
          {#if child.badge}
            <span class="flyout-badge">{child.badge}</span>
          {/if}
        </a>
      {/each}
    {/if}
  </nav>
{/if}

<style>
  .flyout {
    width: 200px;
    background: var(--sidebar-glass, var(--surface-1));
    border-right: 1px solid var(--overlay-border);
    padding: 12px 0;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    box-shadow: 2px 0 12px rgba(0, 0, 0, 0.15);
    z-index: 40;
  }

  .flyout-pinned {
    box-shadow: none;
    border-right: 1px solid var(--overlay-border);
    z-index: auto;
  }

  .flyout-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px 12px;
    border-bottom: 1px solid var(--overlay-border);
    margin-bottom: 6px;
  }

  .flyout-icon { font-size: 1rem; }
  .flyout-title { font-size: 0.8rem; font-weight: 700; color: var(--text); }
  .flyout-subtitle { font-size: 0.62rem; color: var(--muted); margin-top: 1px; }

  .flyout-link {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 16px;
    font-size: 0.77rem;
    color: var(--muted);
    text-decoration: none;
    transition: background 0.1s, color 0.1s;
    border-radius: 0;
  }
  .flyout-link:hover { background: rgba(var(--primary-rgb), 0.07); color: var(--text); }
  .flyout-link.active { font-weight: 600; }

  .flyout-link-icon { font-size: 0.8rem; width: 16px; text-align: center; flex-shrink: 0; }
  .flyout-link-label { flex: 1; }

  .flyout-badge {
    font-size: 0.58rem;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 10px;
    background: rgba(var(--primary-rgb), 0.15);
    color: var(--primary);
    letter-spacing: 0.04em;
  }
</style>
```

- [ ] **Step 2: Type-check**

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -10
```

Expected: 0 errors from `NavFlyout.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/nav/NavFlyout.svelte
git commit -m "feat: add NavFlyout component (float + pinned modes)"
```

---

### Task 5: NavBottomBar component

**Files:**
- Create: `src/lib/components/nav/NavBottomBar.svelte`

- [ ] **Step 1: Create `src/lib/components/nav/NavBottomBar.svelte`**

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { getActiveSectionId } from '$lib/config/nav';

  // 5 tabs shown on mobile
  const MOBILE_TABS = [
    { id: 'dashboard', icon: '📊', label: 'Home',      href: '/dashboard' },
    { id: 'portfolio', icon: '💼', label: 'Portfolio', href: '/holdings' },
    { id: 'ai',        icon: '✦',  label: 'AI',        href: '/ai/copilot' },
    { id: 'optimize',  icon: '⚡', label: 'Optimize',  href: '/optimization/rebalance' },
    { id: 'trades',    icon: '📋', label: 'Trades',    href: '/trades' },
  ];

  $: activeSectionId = getActiveSectionId($page.url.pathname);
</script>

<nav class="bottom-bar" aria-label="Mobile navigation">
  {#each MOBILE_TABS as tab}
    {@const isActive = activeSectionId === tab.id}
    <a
      href={tab.href}
      class="tab"
      class:active={isActive}
      aria-label={tab.label}
    >
      <span class="tab-icon" class:ai-icon={tab.id === 'ai'}>{tab.icon}</span>
      <span class="tab-label">{tab.label}</span>
    </a>
  {/each}
</nav>

<style>
  .bottom-bar {
    display: none; /* shown via media query in AppShell */
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 56px;
    background: var(--sidebar-glass, var(--surface-1));
    border-top: 1px solid var(--overlay-border);
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    z-index: 45;
    flex-direction: row;
    align-items: stretch;
  }

  .tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    text-decoration: none;
    color: var(--muted);
    font-size: 0.6rem;
    font-weight: 500;
    transition: color 0.15s;
  }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--primary); }

  .tab-icon { font-size: 1.1rem; line-height: 1; }
  .ai-icon { color: inherit; }
  .tab.active .ai-icon { color: #3fb950; }

  .tab-label { font-size: 0.58rem; letter-spacing: 0.02em; }

  @media (max-width: 768px) {
    .bottom-bar { display: flex; }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/nav/NavBottomBar.svelte
git commit -m "feat: add NavBottomBar mobile component (5 tabs, ≤768px)"
```

---

### Task 6: Rewrite Sidebar.svelte as icon rail

**Files:**
- Modify: `src/lib/components/portfolioai/Sidebar.svelte` (full rewrite)

The new Sidebar is only the 48px icon rail. It writes to `hoveredSection` and `pinnedSection` stores. `NavFlyout` is rendered in AppShell (next task), not here.

- [ ] **Step 1: Replace `src/lib/components/portfolioai/Sidebar.svelte` entirely**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { NAV_SECTIONS, getActiveSectionId } from '$lib/config/nav';
  import { pinnedSection, hoveredSection, flyoutActive } from '$lib/stores/nav';

  // Expose the rail element so AppShell can pass it to NavFlyout as clickOutside exclude
  export let railEl: HTMLElement | undefined = undefined;

  // Whether we're on a tablet (769–1024px) — click only, no hover
  let isTablet = false;

  $: activeSectionId = getActiveSectionId($page.url.pathname);

  // Hover timers
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    if (!browser) return;
    function check() {
      const w = window.innerWidth;
      isTablet = w > 768 && w <= 1024;
    }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  });

  function onRailMouseEnter(sectionId: string) {
    if (isTablet) return;
    const section = NAV_SECTIONS.find(s => s.id === sectionId);
    if (!section?.children?.length) return; // no fly-out for direct-link sections
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    hoverTimer = setTimeout(() => hoveredSection.set(sectionId), 150);
  }

  function onRailMouseLeave() {
    if (isTablet) return;
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    // Grace period: only close if fly-out is not hovered
    closeTimer = setTimeout(() => {
      if (!$flyoutActive) hoveredSection.set(null);
    }, 200);
  }

  function onRailClick(sectionId: string) {
    const section = NAV_SECTIONS.find(s => s.id === sectionId)!;
    if (section.href) {
      // Direct-link: navigate via <a>, just clear pin
      pinnedSection.set(null);
      hoveredSection.set(null);
      return;
    }
    // Toggle pin
    if ($pinnedSection === sectionId) {
      pinnedSection.set(null);
    } else {
      pinnedSection.set(sectionId);
      hoveredSection.set(null);
      if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    }
  }

  $: mainSections = NAV_SECTIONS.filter(s => s.id !== 'settings');
  $: settingsSection = NAV_SECTIONS.find(s => s.id === 'settings')!;
</script>

<div class="rail" bind:this={railEl}>
  <!-- Logo mark -->
  <div class="rail-logo">◈</div>

  <!-- Main nav icons -->
  <nav class="rail-nav" aria-label="Main navigation">
    {#each mainSections as section}
      {@const isActive = activeSectionId === section.id}
      {@const isPinned = $pinnedSection === section.id}

      {#if section.href}
        <!-- Direct-link (Dashboard) -->
        <a
          href={section.href}
          class="rail-item"
          class:active={isActive}
          aria-label={section.label}
          title={section.label}
          on:mouseenter={() => onRailMouseEnter(section.id)}
          on:mouseleave={onRailMouseLeave}
          on:click={() => onRailClick(section.id)}
        >
          <span
            class="rail-icon"
            style={isActive && section.color ? `color: ${section.color}` : ''}
          >{section.icon}</span>
          {#if isActive}
            <span
              class="rail-indicator"
              style={section.color ? `background: ${section.color}` : ''}
            ></span>
          {/if}
        </a>
      {:else}
        <!-- Section with fly-out -->
        <button
          class="rail-item"
          class:active={isActive}
          class:pinned={isPinned}
          aria-label={section.label}
          aria-expanded={isPinned}
          title={section.label}
          on:mouseenter={() => onRailMouseEnter(section.id)}
          on:mouseleave={onRailMouseLeave}
          on:click={() => onRailClick(section.id)}
        >
          <span
            class="rail-icon"
            style={(isActive || isPinned) && section.color ? `color: ${section.color}` : ''}
          >{section.icon}</span>
          {#if isActive}
            <span
              class="rail-indicator"
              style={section.color ? `background: ${section.color}` : ''}
            ></span>
          {/if}
        </button>
      {/if}
    {/each}
  </nav>

  <!-- Bottom: Settings -->
  <div class="rail-bottom">
    <div class="rail-divider"></div>
    <a
      href={settingsSection.href}
      class="rail-item"
      class:active={activeSectionId === 'settings'}
      aria-label="Settings"
      title="Settings"
    >
      <span class="rail-icon">{settingsSection.icon}</span>
      {#if activeSectionId === 'settings'}
        <span class="rail-indicator"></span>
      {/if}
    </a>
  </div>
</div>

<style>
  .rail {
    width: 48px;
    height: 100%;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0;
    overflow: visible;
  }

  .rail-logo {
    width: 48px;
    height: 56px; /* matches topbar height */
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--primary);
    flex-shrink: 0;
    border-bottom: 1px solid var(--overlay-border);
  }

  .rail-nav {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 0;
    gap: 2px;
    width: 100%;
    overflow-y: auto;
    overflow-x: visible;
  }

  .rail-bottom {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4px 0 8px;
    width: 100%;
    gap: 2px;
  }

  .rail-divider {
    width: 24px;
    height: 1px;
    background: var(--overlay-border);
    margin: 4px 0;
  }

  .rail-item {
    position: relative;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    background: none;
    border: none;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
    flex-shrink: 0;
  }
  .rail-item:hover {
    background: rgba(var(--primary-rgb), 0.08);
    color: var(--text);
  }
  .rail-item.active {
    color: var(--primary);
  }
  .rail-item.pinned {
    background: rgba(var(--primary-rgb), 0.08);
    color: var(--primary);
  }

  .rail-icon {
    font-size: 1rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Active left-border indicator */
  .rail-indicator {
    position: absolute;
    left: -6px; /* bleeds into the border between rail and fly-out */
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 20px;
    background: var(--primary);
    border-radius: 0 2px 2px 0;
  }
</style>
```

- [ ] **Step 2: Type-check**

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "error|Error" | head -10
```

Expected: 0 errors from Sidebar.svelte.

- [ ] **Step 3: Run unit tests**

```bash
npx vitest run
```

Expected: All tests still PASS (no regressions).

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/portfolioai/Sidebar.svelte
git commit -m "feat: rewrite Sidebar as 48px icon rail"
```

---

### Task 7: Update AppShell.svelte

**Files:**
- Modify: `src/lib/components/portfolioai/AppShell.svelte`

Changes:
1. Read `pinnedSection` + `hoveredSection` stores to show `NavFlyout`
2. Sidebar always 48px — remove `sidebarCollapsed` collapse logic
3. Render flyout as sibling to sidebar in `shell-body`
4. Add `NavBottomBar`
5. Remove mobile sidebar drawer (replaced by bottom bar)
6. Bump `shell-topbar` z-index from 40 → 50
7. Keep `toggleSidebar` wired to pin-toggle (gives topbar button a function)

- [ ] **Step 1: Replace `src/lib/components/portfolioai/AppShell.svelte` entirely**

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { navigating } from '$app/stores';
  import { onMount } from 'svelte';
  import Sidebar from './Sidebar.svelte';
  import Topbar  from './Topbar.svelte';
  import NavFlyout from '$lib/components/nav/NavFlyout.svelte';
  import NavBottomBar from '$lib/components/nav/NavBottomBar.svelte';
  import { pinnedSection, hoveredSection, flyoutActive } from '$lib/stores/nav';
  import { NAV_SECTIONS, getActiveSectionId } from '$lib/config/nav';

  export let showAiPanel = false;

  let railEl: HTMLElement | undefined = undefined;
  let aiPanelOpen = showAiPanel;

  const AI_PANEL_ROUTES = ['/dashboard', '/ai'];

  onMount(() => {
    const stored = localStorage.getItem('portfolioai:ai-panel-open');
    if (stored !== null) {
      aiPanelOpen = stored === 'true';
    } else {
      const path = $page.url.pathname;
      aiPanelOpen = AI_PANEL_ROUTES.some(r => path === r || path.startsWith(r + '/'));
    }
  });

  // Which section's fly-out to show (pinned takes precedence over hovered)
  $: visibleSectionId = $pinnedSection ?? $hoveredSection;
  $: visibleSection = visibleSectionId
    ? (NAV_SECTIONS.find(s => s.id === visibleSectionId) ?? null)
    : null;
  $: showFlyout = visibleSection !== null && (visibleSection.children?.length ?? 0) > 0;
  $: isFlyoutPinned = $pinnedSection !== null && $pinnedSection === visibleSectionId;

  function closeFlyout() {
    pinnedSection.set(null);
    hoveredSection.set(null);
    flyoutActive.set(false);
  }

  function toggleAiPanel() {
    aiPanelOpen = !aiPanelOpen;
    localStorage.setItem('portfolioai:ai-panel-open', String(aiPanelOpen));
  }

  // Topbar logo/grid button: toggle pin for the currently active section
  function toggleSidebar() {
    const activeSectionId = getActiveSectionId($page.url.pathname);
    if (!activeSectionId) return;
    const section = NAV_SECTIONS.find(s => s.id === activeSectionId);
    if (!section?.children?.length) return; // direct-link sections have no fly-out
    if ($pinnedSection === activeSectionId) {
      pinnedSection.set(null);
    } else {
      pinnedSection.set(activeSectionId);
    }
  }
</script>

<div class="shell">

  <!-- Navigation progress bar -->
  {#if $navigating}
    <div class="nav-bar"><div class="nav-bar-fill"></div></div>
  {/if}

  <!-- Topbar -->
  <header class="shell-topbar">
    <Topbar
      sidebarCollapsed={false}
      {aiPanelOpen}
      on:toggleSidebar={toggleSidebar}
      on:toggleAiPanel={toggleAiPanel}
    />
  </header>

  <div class="shell-body">

    <!-- Icon Rail (always 48px) -->
    <aside class="shell-sidebar">
      <Sidebar bind:railEl />
    </aside>

    <!-- Fly-out panel: float (absolute) or pinned (static flex child) -->
    {#if showFlyout && visibleSection}
      <div class="flyout-wrapper" class:pinned={isFlyoutPinned}>
        <NavFlyout
          section={visibleSection}
          isPinned={isFlyoutPinned}
          {railEl}
          on:close={closeFlyout}
        />
      </div>
    {/if}

    <!-- Main content -->
    <main class="shell-main custom-scrollbar">
      <slot />
    </main>

  </div>
</div>

<!-- AI Panel — fixed overlay -->
{#if aiPanelOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="ai-panel-backdrop" on:click={toggleAiPanel}></div>
  <aside class="shell-ai-panel custom-scrollbar">
    <slot name="aiPanel">
      <div class="ai-panel-placeholder">
        <div style="font-size:0.7rem;color:var(--primary);font-weight:700;margin-bottom:8px">✦ AI PANEL</div>
        <div style="font-size:0.75rem;color:var(--muted);line-height:1.6">
          Navigate to a page to see AI context here.
        </div>
      </div>
    </slot>
  </aside>
{/if}

<!-- Mobile bottom navigation -->
<NavBottomBar />

<style>
  .nav-bar {
    position: fixed; top: 0; left: 0; right: 0; height: 2px; z-index: 9999;
    background: rgba(var(--primary-rgb), 0.15);
  }
  .nav-bar-fill {
    height: 100%; width: 80%;
    background: var(--primary);
    animation: nav-progress 1.6s ease-in-out infinite;
    border-radius: 0 2px 2px 0;
  }
  @keyframes nav-progress {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(150%); }
  }

  .shell {
    display: flex; flex-direction: column;
    height: 100vh; overflow: hidden;
    background: var(--bg);
  }

  .shell-topbar {
    height: 56px; flex-shrink: 0;
    border-bottom: 1px solid var(--overlay-border);
    background: var(--bg-glass);
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    z-index: 50; /* ↑ bumped from 40 — must be above fly-out (z-index: 40) */
    box-shadow: 0 1px 0 rgba(var(--primary-rgb),0.06), 0 4px 24px rgba(0,0,0,0.2);
  }

  .shell-body {
    display: flex; flex: 1; overflow: hidden; position: relative;
  }

  /* Icon rail — always 48px, never collapses */
  .shell-sidebar {
    width: 48px; flex-shrink: 0;
    border-right: 1px solid var(--overlay-border);
    background: var(--sidebar-glass);
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    box-shadow: 1px 0 0 rgba(var(--primary-rgb),0.05);
    z-index: 30;
    overflow: visible; /* allow fly-out indicator to bleed */
  }

  /* Fly-out wrapper */
  .flyout-wrapper {
    /* Float mode: absolute, overlays main content */
    position: absolute;
    left: 48px;
    top: 0;
    bottom: 0;
    width: 200px;
    z-index: 40;
  }
  .flyout-wrapper.pinned {
    /* Pinned mode: part of flex layout, pushes main content right */
    position: static;
    flex-shrink: 0;
    z-index: auto;
  }

  .shell-main {
    flex: 1; overflow-y: auto;
    padding: 24px 28px;
    min-width: 0;
  }

  /* AI panel */
  .shell-ai-panel {
    position: fixed;
    top: 56px; right: 0; bottom: 0;
    width: 300px;
    border-left: 1px solid var(--border);
    background: var(--ai-glass);
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    overflow-y: auto;
    padding: 16px;
    z-index: 30;
    box-shadow: -4px 0 24px rgba(0,0,0,0.25);
  }

  .ai-panel-backdrop {
    position: fixed; inset: 56px 0 0 0; z-index: 29;
    background: transparent;
  }

  .ai-panel-placeholder { padding: 8px; }

  /* Mobile: hide sidebar, show bottom bar space */
  @media (max-width: 768px) {
    .shell-sidebar  { display: none; }
    .flyout-wrapper { display: none; }
    .shell-main     { padding: 16px; padding-bottom: 72px; /* space for bottom bar */ }
    .shell-ai-panel { width: 100%; max-width: 320px; }
  }

  /* Tablet: show rail, click-only (handled in Sidebar.svelte via isTablet) */
  @media (min-width: 769px) and (max-width: 1024px) {
    .shell-main { padding: 20px; }
  }
</style>
```

- [ ] **Step 2: Type-check the full project**

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "error|Error" | head -20
```

Expected: 0 errors. Fix any that appear before continuing.

- [ ] **Step 3: Run unit tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 4: Start dev server and verify in browser**

```bash
npm run dev
```

Open http://localhost:5173

Verify:
- [ ] 48px icon rail visible on left
- [ ] Hover a section icon (e.g., 💼 Portfolio) → fly-out appears after ~150ms
- [ ] Move mouse to fly-out → fly-out stays open (grace period working)
- [ ] Click an icon → fly-out pins (content shifts right)
- [ ] Click same icon again → unpins
- [ ] Click link in pinned fly-out → navigates, fly-out stays pinned
- [ ] Press Escape → fly-out closes
- [ ] Click outside fly-out → fly-out closes
- [ ] Dashboard icon → navigates directly, no fly-out
- [ ] Settings icon (bottom) → navigates directly
- [ ] Active icon has left-border indicator on current page
- [ ] AI section shows green left border on `/ai/*` routes
- [ ] Resize to ≤768px → sidebar hidden, bottom tab bar appears
- [ ] Bottom tabs navigate correctly

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/portfolioai/AppShell.svelte
git commit -m "feat: update AppShell for icon rail layout — flyout container, z-index fixes, mobile bottom bar"
```

---

### Final verification

- [ ] **Run full test suite**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Type-check**

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: Build succeeds with no errors.

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: complete nav restructure — icon rail + fly-out panel

- 48px icon rail with 8 sections + Settings
- Hover-to-preview, click-to-pin fly-out
- Content push when pinned
- Mobile bottom tab bar (5 tabs, ≤768px)
- All 60+ routes now accessible via nav"
```
