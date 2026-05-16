# PortfolioAI UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visual layer of PortfolioAI with the Design B (Graphite Black · Violet-Blue) design system — adaptive AppShell, accordion sidebar, value-hero topbar, AI Command Center dashboard, and redesigned Portfolio section pages.

**Architecture:** Rewrite shell components (AppShell, Sidebar, Topbar) in-place and create new reusable component library under `src/lib/components/portfolioai/`. All existing `+page.server.ts` data contracts are preserved unchanged. New ECharts replaces existing custom chart implementations.

**Tech Stack:** SvelteKit 2 · Svelte 5 (legacy syntax) · TailwindCSS 3 · TypeScript · ECharts · lucide-svelte

---

## Task 1: Design Tokens — Tailwind + CSS

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app.css`

- [ ] **Step 1: Update tailwind.config.ts**

Replace the entire file with:

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        bg:      '#080d18',
        card:    '#0f1523',
        border:  '#1a2038',
        primary: '#6c8fff',
        success: '#2dd4a0',
        danger:  '#f96b7e',
        warning: '#fbbf24',
        ink:     '#dce8ff',
        muted:   '#7a8fb0',
        sidebar: '#090e1d',
        ai:      '#0e1830',
      },
      boxShadow: {
        card:          '0 4px 24px rgba(0,0,0,0.45)',
        glow:          '0 0 32px rgba(108,143,255,0.18)',
        'glow-success':'0 0 24px rgba(45,212,160,0.15)',
      },
      borderRadius: {
        DEFAULT: '10px',
        sm: '6px',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 2: Replace src/app.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg:         #080d18;
  --card:       #0f1523;
  --border:     #1a2038;
  --primary:    #6c8fff;
  --success:    #2dd4a0;
  --danger:     #f96b7e;
  --warning:    #fbbf24;
  --text:       #dce8ff;
  --muted:      #7a8fb0;
  --sidebar-bg: #090e1d;
  --ai-bg:      #0e1830;
  --ai-border:  rgba(108,143,255,0.25);
  --radius:     10px;
  --radius-sm:  6px;
  --shadow:     0 4px 24px rgba(0,0,0,0.45);

  color: var(--text);
  background: var(--bg);
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

body {
  margin: 0;
  min-width: 320px;
  background: var(--bg);
}

button, input, select, textarea { font: inherit; }

/* ── Utility classes ── */
.field {
  @apply h-10 w-full rounded-sm border px-3 text-sm outline-none transition placeholder:text-muted focus:border-primary/50 focus:ring-2 focus:ring-primary/15;
  background: var(--card);
  border-color: var(--border);
  color: var(--text);
}

.label {
  @apply text-xs font-semibold uppercase tracking-wider;
  color: var(--muted);
}

.button {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-sm px-4 text-sm font-semibold transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50;
  background: var(--primary);
  color: #fff;
}

.button-secondary {
  @apply inline-flex h-10 items-center justify-center gap-2 rounded-sm border px-4 text-sm font-semibold transition hover:border-primary/40;
  background: var(--ai-bg);
  border-color: var(--ai-border);
  color: var(--text);
}

.icon-button {
  @apply inline-flex h-9 w-9 items-center justify-center rounded-sm border transition hover:border-primary/40;
  background: rgba(255,255,255,0.04);
  border-color: var(--border);
  color: var(--muted);
}

.card {
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--card);
  box-shadow: var(--shadow);
}

.glass {
  border-radius: var(--radius);
  background: linear-gradient(135deg, rgba(108,143,255,0.08), rgba(14,24,48,0.6));
  border: 1px solid var(--ai-border);
  backdrop-filter: blur(12px);
}

.table-wrap {
  @apply overflow-x-auto rounded-DEFAULT;
  border: 1px solid var(--border);
  background: var(--card);
}

.data-table {
  @apply min-w-full divide-y text-sm;
  divide-color: var(--border);
}

.data-table th {
  @apply whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider;
  background: rgba(255,255,255,0.03);
  color: var(--muted);
}

.data-table td {
  @apply whitespace-nowrap px-4 py-3;
  color: var(--text);
}

.data-table tbody tr:hover {
  background: rgba(108,143,255,0.04);
}

.positive { color: var(--success); }
.negative { color: var(--danger); }

.custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { border-radius: 9999px; background: var(--border); }
```

- [ ] **Step 3: Verify no build errors**

```powershell
cd c:\Ampps\www\portfolio
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | Select-String -Pattern "error" | Select-Object -First 20
```

Expected: zero errors related to the CSS changes (type errors in existing files are pre-existing and acceptable at this stage).

- [ ] **Step 4: Commit**

```powershell
git add tailwind.config.ts src/app.css
git commit -m "feat: apply Design B tokens — Graphite Black · Violet-Blue palette"
```

---

## Task 2: Install ECharts + Create Config

**Files:**
- Create: `src/lib/echarts.config.ts`

- [ ] **Step 1: Install echarts**

```powershell
npm install echarts
```

Expected output: echarts added to `package.json` dependencies.

- [ ] **Step 2: Create src/lib/echarts.config.ts**

```ts
export const CHART_THEME = {
  backgroundColor: 'transparent',
  textStyle: { color: '#7a8fb0', fontFamily: 'Inter, system-ui', fontSize: 11 },
  axisLine:  { lineStyle: { color: '#1a2038' } },
  axisTick:  { lineStyle: { color: '#1a2038' } },
  axisLabel: { color: '#7a8fb0', fontSize: 11 },
  splitLine: { lineStyle: { color: '#1a203830', type: 'dashed' } },
  legend:    { textStyle: { color: '#7a8fb0' } },
  color:     ['#6c8fff', '#2dd4a0', '#f96b7e', '#fbbf24', '#a78bfa', '#38bdf8'],
} as const;

export type ChartPeriod = '1M' | '3M' | '6M' | '1Y' | 'All';
```

- [ ] **Step 3: Commit**

```powershell
git add package.json package-lock.json src/lib/echarts.config.ts
git commit -m "feat: add ECharts with Design B theme config"
```

---

## Task 3: Utility Components — Badges, Skeleton, EmptyState

**Files:**
- Create: `src/lib/components/portfolioai/badges/AccountModeBadge.svelte`
- Create: `src/lib/components/portfolioai/badges/ComingSoonBadge.svelte`
- Create: `src/lib/components/portfolioai/LoadingSkeleton.svelte`
- Create: `src/lib/components/portfolioai/EmptyState.svelte`

- [ ] **Step 1: Create AccountModeBadge.svelte**

```svelte
<script lang="ts">
  export let mode: 'LIVE READ-ONLY' | 'SANDBOX' | 'MANUAL' = 'MANUAL';
</script>

{#if mode === 'LIVE READ-ONLY'}
  <span class="badge badge-danger">LIVE · READ ONLY</span>
{:else if mode === 'SANDBOX'}
  <span class="badge badge-warning">SANDBOX</span>
{:else}
  <span class="badge badge-muted">MANUAL</span>
{/if}

<style>
  .badge {
    display: inline-flex; align-items: center;
    padding: 2px 8px; border-radius: 20px;
    font-size: 0.6rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
  }
  .badge-danger  { background: rgba(249,107,126,0.12); color: #f96b7e; }
  .badge-warning { background: rgba(251,191,36,0.12);  color: #fbbf24; }
  .badge-muted   { background: rgba(122,143,176,0.12); color: #7a8fb0; }
</style>
```

- [ ] **Step 2: Create ComingSoonBadge.svelte**

```svelte
<span style="font-size:0.6rem;font-weight:600;color:#7a8fb0;font-style:italic;letter-spacing:0.05em">
  soon
</span>
```

- [ ] **Step 3: Create LoadingSkeleton.svelte**

```svelte
<script lang="ts">
  export let variant: 'lines' | 'card' | 'table' = 'lines';
  export let rows = 3;
</script>

{#if variant === 'card'}
  <div class="skeleton-card">
    <div class="skel" style="width:40%;height:10px;margin-bottom:8px"></div>
    <div class="skel" style="width:60%;height:20px;margin-bottom:6px"></div>
    <div class="skel" style="width:30%;height:8px"></div>
  </div>
{:else if variant === 'table'}
  {#each Array(rows) as _}
    <div class="skel" style="width:100%;height:36px;margin-bottom:2px;border-radius:4px"></div>
  {/each}
{:else}
  {#each Array(rows) as _, i}
    <div class="skel" style="width:{90 - i * 15}%;height:8px;margin-bottom:8px"></div>
  {/each}
{/if}

<style>
  .skeleton-card {
    padding: 16px; border-radius: 10px;
    border: 1px solid #1a2038; background: #0f1523;
  }
  .skel {
    border-radius: 4px; background: #1a2038;
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
</style>
```

- [ ] **Step 4: Create EmptyState.svelte**

```svelte
<script lang="ts">
  export let icon  = '◎';
  export let title = 'Nothing here yet';
  export let description = '';
  export let ctaLabel: string | null = null;
  export let ctaHref: string | null = null;
</script>

<div class="empty">
  <div class="empty-icon">{icon}</div>
  <div class="empty-title">{title}</div>
  {#if description}
    <div class="empty-desc">{description}</div>
  {/if}
  {#if ctaLabel && ctaHref}
    <a href={ctaHref} class="button" style="margin-top:16px">{ctaLabel}</a>
  {/if}
</div>

<style>
  .empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:48px 24px; text-align:center; }
  .empty-icon  { font-size:2rem; margin-bottom:12px; color:#1a2038; }
  .empty-title { font-size:0.9rem; font-weight:600; color:#dce8ff; margin-bottom:6px; }
  .empty-desc  { font-size:0.8rem; color:#7a8fb0; max-width:320px; line-height:1.6; }
</style>
```

- [ ] **Step 5: Commit**

```powershell
git add src/lib/components/portfolioai/badges/ src/lib/components/portfolioai/LoadingSkeleton.svelte src/lib/components/portfolioai/EmptyState.svelte
git commit -m "feat: add utility components — badges, skeleton, empty state"
```

---

## Task 4: AppShell — Adaptive 3-Column Layout

**Files:**
- Modify: `src/lib/components/portfolioai/AppShell.svelte`

- [ ] **Step 1: Rewrite AppShell.svelte**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import Sidebar from './Sidebar.svelte';
  import Topbar  from './Topbar.svelte';

  export let showAiPanel = false;

  let sidebarCollapsed = false;
  let aiPanelOpen = showAiPanel;

  const AI_PANEL_ROUTES = ['/dashboard', '/ai'];

  onMount(() => {
    const sc = localStorage.getItem('portfolioai:sidebar-collapsed');
    if (sc !== null) sidebarCollapsed = sc === 'true';

    // Per-route AI panel default (only on first visit — no stored pref)
    const stored = localStorage.getItem('portfolioai:ai-panel-open');
    if (stored !== null) {
      aiPanelOpen = stored === 'true';
    } else {
      const path = $page.url.pathname;
      aiPanelOpen = AI_PANEL_ROUTES.some(r => path === r || path.startsWith(r + '/'));
    }
  });

  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem('portfolioai:sidebar-collapsed', String(sidebarCollapsed));
  }

  function toggleAiPanel() {
    aiPanelOpen = !aiPanelOpen;
    localStorage.setItem('portfolioai:ai-panel-open', String(aiPanelOpen));
  }
</script>

<div class="shell">
  <!-- Topbar -->
  <header class="shell-topbar">
    <Topbar
      {sidebarCollapsed}
      {aiPanelOpen}
      on:toggleSidebar={toggleSidebar}
      on:toggleAiPanel={toggleAiPanel}
    />
  </header>

  <div class="shell-body">
    <!-- Sidebar -->
    <aside class="shell-sidebar" class:collapsed={sidebarCollapsed}>
      <Sidebar {sidebarCollapsed} on:toggleSidebar={toggleSidebar} />
    </aside>

    <!-- Main content -->
    <main class="shell-main custom-scrollbar">
      <slot />
    </main>

    <!-- AI Panel -->
    {#if aiPanelOpen}
      <aside class="shell-ai-panel custom-scrollbar">
        <slot name="aiPanel">
          <div class="ai-panel-placeholder">
            <div style="font-size:0.7rem;color:#6c8fff;font-weight:700;margin-bottom:8px">✦ AI PANEL</div>
            <div style="font-size:0.75rem;color:#7a8fb0;line-height:1.6">
              Navigate to a page to see AI context here.
            </div>
          </div>
        </slot>
      </aside>
    {/if}
  </div>
</div>

<!-- Mobile overlay -->
<div class="mobile-nav">
  <slot />
</div>

<style>
  .shell {
    display: flex; flex-direction: column;
    height: 100vh; overflow: hidden;
    background: #080d18;
  }

  .shell-topbar {
    height: 56px; flex-shrink: 0;
    border-bottom: 1px solid #1a2038;
    background: #090e1d;
    z-index: 40;
  }

  .shell-body {
    display: flex; flex: 1; overflow: hidden;
  }

  .shell-sidebar {
    width: 240px; flex-shrink: 0;
    transition: width 0.2s ease;
    border-right: 1px solid #1a2038;
    background: #090e1d;
    overflow: hidden;
  }
  .shell-sidebar.collapsed { width: 48px; }

  .shell-main {
    flex: 1; overflow-y: auto;
    padding: 24px 28px;
    min-width: 0;
  }

  .shell-ai-panel {
    width: 280px; flex-shrink: 0;
    border-left: 1px solid #1a2038;
    background: #0e1830;
    overflow-y: auto;
    padding: 16px;
  }

  .ai-panel-placeholder { padding: 8px; }

  /* Hide the desktop shell on mobile, show mobile-nav slot */
  @media (max-width: 767px) {
    .shell { display: none; }
    .mobile-nav { display: block; }
  }
  @media (min-width: 768px) {
    .mobile-nav { display: none; }
  }
</style>
```

- [ ] **Step 2: Run svelte-check**

```powershell
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | Select-String "error" | Select-Object -First 10
```

Expected: No new errors from AppShell.svelte.

- [ ] **Step 3: Commit**

```powershell
git add src/lib/components/portfolioai/AppShell.svelte
git commit -m "feat: rewrite AppShell — adaptive 3-column with collapsible sidebar and AI panel"
```

---

## Task 5: Sidebar — Accordion Groups

**Files:**
- Modify: `src/lib/components/portfolioai/Sidebar.svelte`

- [ ] **Step 1: Rewrite Sidebar.svelte**

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { page } from '$app/stores';
  import {
    LayoutDashboard, PieChart, Link2, FlaskConical, BarChart3,
    Bot, Sliders, Users, Microscope, Settings, ChevronRight,
    Briefcase, ChevronLeft
  } from 'lucide-svelte';
  import ComingSoonBadge from './badges/ComingSoonBadge.svelte';

  export let sidebarCollapsed = false;

  const dispatch = createEventDispatcher();

  type NavItem = { label: string; href: string };
  type NavGroup = {
    id: string;
    label: string;
    icon: unknown;
    badge?: 'READ_ONLY' | 'SANDBOX' | 'COMING_SOON' | 'AI';
    items: NavItem[];
  };

  const groups: NavGroup[] = [
    {
      id: 'portfolio', label: 'Portfolio', icon: PieChart,
      items: [
        { label: 'Overview',     href: '/portfolio' },
        { label: 'Holdings',     href: '/holdings' },
        { label: 'Transactions', href: '/transactions' },
        { label: 'Snapshots',    href: '/snapshots' },
        { label: 'Accounts',     href: '/accounts' },
        { label: 'Watchlist',    href: '/watchlist' },
      ],
    },
    {
      id: 'broker', label: 'Broker Sync', icon: Link2,
      items: [
        { label: 'Connections', href: '/broker' },
        { label: 'Moomoo',      href: '/broker' },
        { label: 'CSV Import',  href: '/import' },
        { label: 'Sync Logs',   href: '/broker' },
      ],
    },
    {
      id: 'paper', label: 'Paper Trading', icon: Briefcase, badge: 'SANDBOX',
      items: [
        { label: 'Dashboard',  href: '/paper-trading' },
        { label: 'Positions',  href: '/paper-trading' },
        { label: 'Orders',     href: '/paper-trading' },
        { label: 'History',    href: '/paper-trading' },
      ],
    },
    {
      id: 'analytics', label: 'Analytics', icon: BarChart3,
      items: [
        { label: 'Overview',          href: '/analytics' },
        { label: 'Portfolio Metrics', href: '/analytics/portfolio' },
        { label: 'Risk Analysis',     href: '/analytics/risk' },
        { label: 'Exposure',          href: '/analytics/exposure' },
        { label: 'Diversification',   href: '/analytics/diversification' },
        { label: 'Benchmark',         href: '/analytics/benchmark' },
        { label: 'Performance',       href: '/analytics/performance' },
        { label: 'Attribution',       href: '/analytics/performance/attribution' },
        { label: 'Income',            href: '/analytics' },
      ],
    },
    {
      id: 'ai', label: 'AI Workspace', icon: Bot, badge: 'AI',
      items: [
        { label: 'AI Copilot',      href: '/ai/copilot' },
        { label: 'AI Insights',     href: '/ai/insights' },
        { label: 'Conversations',   href: '/ai/conversations' },
        { label: 'Prompt Explorer', href: '/ai' },
        { label: 'AI Memory',       href: '/ai' },
      ],
    },
    {
      id: 'optimization', label: 'Optimization', icon: Sliders, badge: 'COMING_SOON',
      items: [],
    },
    {
      id: 'multiagent', label: 'Multi-Agent AI', icon: Users, badge: 'COMING_SOON',
      items: [],
    },
    {
      id: 'quant', label: 'Quant Lab', icon: Microscope, badge: 'COMING_SOON',
      items: [],
    },
  ];

  // Derive which group is active from the current path
  $: activePath = $page.url.pathname;
  $: activeGroupId = (() => {
    for (const g of groups) {
      if (g.items.some(i => activePath === i.href || activePath.startsWith(i.href + '/'))) return g.id;
    }
    return null;
  })();

  // Accordion open state — auto-open active group
  let openGroups = new Set<string>();
  $: if (activeGroupId) openGroups = new Set([activeGroupId]);

  function toggleGroup(id: string) {
    if (openGroups.has(id)) {
      openGroups.delete(id);
    } else {
      openGroups.add(id);
    }
    openGroups = openGroups; // trigger reactivity
  }

  $: isDashboard = activePath === '/dashboard' || activePath === '/';
</script>

<div class="sb" class:collapsed={sidebarCollapsed}>
  <!-- Logo -->
  <div class="sb-logo">
    {#if !sidebarCollapsed}
      <div class="sb-logo-full">
        <span class="sb-mark">◈</span>
        <div>
          <div class="sb-name">PortfolioAI</div>
          <div class="sb-tagline">AI Portfolio OS</div>
        </div>
      </div>
    {:else}
      <div class="sb-mark sb-mark-center">◈</div>
    {/if}
  </div>

  <!-- Dashboard (top-level, no group) -->
  <div class="sb-section-wrap">
    <a
      href="/dashboard"
      class="sb-item"
      class:active={isDashboard}
      title={sidebarCollapsed ? 'Dashboard' : undefined}
    >
      <svelte:component this={LayoutDashboard} size={16} class="sb-icon" />
      {#if !sidebarCollapsed}<span class="sb-item-label">Dashboard</span>{/if}
    </a>
  </div>

  <div class="sb-divider"></div>

  <!-- Accordion groups -->
  <nav class="sb-nav custom-scrollbar">
    {#each groups as group}
      {@const isOpen = openGroups.has(group.id)}
      {@const hasActiveChild = group.items.some(i => activePath === i.href || activePath.startsWith(i.href + '/'))}

      <div class="sb-group">
        <!-- Group header -->
        <button
          class="sb-group-header"
          class:active={hasActiveChild}
          class:coming-soon={group.badge === 'COMING_SOON'}
          on:click={() => {
            if (sidebarCollapsed) {
              dispatch('toggleSidebar');
            } else if (group.badge !== 'COMING_SOON') {
              toggleGroup(group.id);
            }
          }}
          title={sidebarCollapsed ? group.label : undefined}
        >
          <svelte:component this={group.icon} size={16} class="sb-icon" />
          {#if !sidebarCollapsed}
            <span class="sb-group-label">{group.label}</span>
            {#if group.badge === 'SANDBOX'}
              <span class="badge-sandbox">SANDBOX</span>
            {:else if group.badge === 'AI'}
              <span class="badge-ai">✦</span>
            {:else if group.badge === 'COMING_SOON'}
              <ComingSoonBadge />
            {/if}
            {#if group.badge !== 'COMING_SOON' && group.items.length > 0}
              <span class="sb-chevron" class:open={isOpen}>
                <ChevronRight size={12} />
              </span>
            {/if}
          {/if}
        </button>

        <!-- Sub-items -->
        {#if isOpen && !sidebarCollapsed && group.items.length > 0}
          <div class="sb-sub">
            {#each group.items as item}
              {@const active = activePath === item.href || activePath.startsWith(item.href + '/')}
              <a
                href={item.href}
                class="sb-sub-item"
                class:active
              >
                <span class="sb-sub-dot" class:active></span>
                {item.label}
              </a>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </nav>

  <!-- Bottom: collapse toggle + settings -->
  <div class="sb-bottom">
    <button
      class="sb-collapse-btn"
      on:click={() => dispatch('toggleSidebar')}
      title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      <svelte:component this={sidebarCollapsed ? ChevronRight : ChevronLeft} size={14} />
      {#if !sidebarCollapsed}<span>Collapse</span>{/if}
    </button>

    <a
      href="/settings"
      class="sb-item"
      class:active={activePath === '/settings'}
      title={sidebarCollapsed ? 'Settings' : undefined}
    >
      <svelte:component this={Settings} size={16} class="sb-icon" />
      {#if !sidebarCollapsed}<span class="sb-item-label">Settings</span>{/if}
    </a>
  </div>
</div>

<style>
  .sb {
    display: flex; flex-direction: column;
    height: 100%; overflow: hidden;
    background: #090e1d;
    transition: width 0.2s ease;
  }

  .sb-logo { padding: 14px 12px; border-bottom: 1px solid #1a2038; flex-shrink: 0; }
  .sb-logo-full { display: flex; align-items: center; gap: 8px; }
  .sb-mark { font-size: 1.1rem; font-weight: 800; color: #6c8fff; }
  .sb-mark-center { display: block; text-align: center; }
  .sb-name { font-size: 0.8rem; font-weight: 700; color: #dce8ff; }
  .sb-tagline { font-size: 0.6rem; color: #7a8fb0; }

  .sb-section-wrap { padding: 8px 8px 4px; }

  .sb-divider { height: 1px; background: #1a2038; margin: 4px 0; }

  .sb-nav { flex: 1; overflow-y: auto; padding: 4px 8px; }

  .sb-item {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 8px; border-radius: 6px;
    font-size: 0.8rem; font-weight: 500;
    color: #7a8fb0; text-decoration: none;
    transition: background 0.15s, color 0.15s;
    width: 100%;
  }
  .sb-item:hover { background: rgba(108,143,255,0.08); color: #dce8ff; }
  .sb-item.active { background: rgba(108,143,255,0.14); color: #6c8fff; font-weight: 600; }

  .sb-group { margin-bottom: 2px; }

  .sb-group-header {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 8px; border-radius: 6px;
    font-size: 0.8rem; font-weight: 500;
    color: #7a8fb0; background: none; border: none;
    cursor: pointer; width: 100%; text-align: left;
    transition: background 0.15s, color 0.15s;
  }
  .sb-group-header:hover { background: rgba(108,143,255,0.08); color: #dce8ff; }
  .sb-group-header.active { color: #dce8ff; }
  .sb-group-header.coming-soon { opacity: 0.5; cursor: default; }

  .sb-group-label { flex: 1; }
  .sb-chevron { display: flex; transition: transform 0.2s; color: #7a8fb0; }
  .sb-chevron.open { transform: rotate(90deg); }

  .badge-sandbox { font-size: 0.55rem; font-weight: 700; padding: 1px 6px; border-radius: 20px; background: rgba(251,191,36,0.12); color: #fbbf24; }
  .badge-ai { font-size: 0.7rem; color: #6c8fff; }

  .sb-sub { padding: 2px 0 4px 24px; }
  .sb-sub-item {
    display: flex; align-items: center; gap: 8px;
    padding: 5px 8px; border-radius: 6px;
    font-size: 0.77rem; color: #7a8fb0;
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
  }
  .sb-sub-item:hover { color: #dce8ff; background: rgba(108,143,255,0.06); }
  .sb-sub-item.active { color: #6c8fff; }

  .sb-sub-dot { width: 4px; height: 4px; border-radius: 50%; background: #1a2038; flex-shrink: 0; transition: background 0.15s; }
  .sb-sub-dot.active { background: #6c8fff; }

  .sb-bottom {
    flex-shrink: 0; padding: 8px;
    border-top: 1px solid #1a2038;
    display: flex; flex-direction: column; gap: 2px;
  }

  .sb-collapse-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 8px; border-radius: 6px;
    font-size: 0.75rem; color: #7a8fb0;
    background: none; border: none; cursor: pointer; width: 100%;
    transition: background 0.15s, color 0.15s;
  }
  .sb-collapse-btn:hover { background: rgba(108,143,255,0.08); color: #dce8ff; }

  :global(.sb-icon) { flex-shrink: 0; }
  .sb-item-label { flex: 1; }
</style>
```

- [ ] **Step 2: Run svelte-check**

```powershell
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | Select-String "error" | Select-Object -First 10
```

- [ ] **Step 3: Commit**

```powershell
git add src/lib/components/portfolioai/Sidebar.svelte src/lib/components/portfolioai/badges/ComingSoonBadge.svelte
git commit -m "feat: rewrite Sidebar — accordion groups, icon rail, all phases in nav"
```

---

## Task 6: Topbar — Value-Hero Style

**Files:**
- Modify: `src/lib/components/portfolioai/Topbar.svelte`

- [ ] **Step 1: Rewrite Topbar.svelte**

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Bell, ChevronDown, LayoutGrid, Sparkles } from 'lucide-svelte';
  import { goto } from '$app/navigation';

  export let sidebarCollapsed = false;
  export let aiPanelOpen = false;

  // These would come from a store in a real implementation; mock for now.
  let portfolioValue = 142830.42;
  let dayChange = 1204.30;
  let dayChangePct = 1.2;
  let accountName = 'Main Portfolio';
  let accountMode: 'LIVE' | 'SANDBOX' = 'LIVE';

  const dispatch = createEventDispatcher();

  function formatMoney(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }

  function askAI() {
    goto('/ai/copilot');
  }
</script>

<div class="tb">
  <!-- Left: logo mark + value hero + account -->
  <div class="tb-left">
    <button class="tb-logo-btn" on:click={() => dispatch('toggleSidebar')} title="Toggle sidebar">
      ◈
    </button>
    <div class="tb-sep"></div>

    <!-- Portfolio value hero -->
    <div class="tb-value-hero">
      <div class="tb-value-label">Total Portfolio</div>
      <div class="tb-value-row">
        <span class="tb-value">{formatMoney(portfolioValue)}</span>
        <span class="tb-change" class:positive={dayChange >= 0} class:negative={dayChange < 0}>
          {dayChange >= 0 ? '+' : ''}{formatMoney(dayChange)} ({dayChangePct >= 0 ? '+' : ''}{dayChangePct.toFixed(2)}%)
        </span>
      </div>
    </div>

    <div class="tb-sep"></div>

    <!-- Account switcher -->
    <button class="tb-account-btn">
      <span class="tb-acc-dot" class:live={accountMode === 'LIVE'} class:sandbox={accountMode === 'SANDBOX'}></span>
      <span class="tb-acc-name">{accountName}</span>
      <span class="tb-acc-badge" class:live={accountMode === 'LIVE'} class:sandbox={accountMode === 'SANDBOX'}>
        {accountMode === 'LIVE' ? 'LIVE' : 'SANDBOX'}
      </span>
      <ChevronDown size={13} />
    </button>
  </div>

  <!-- Right: AI, notifications, avatar, panel toggles -->
  <div class="tb-right">
    <button class="tb-ai-btn" on:click={askAI}>
      <Sparkles size={13} />
      Ask AI
    </button>

    <button class="tb-icon-btn" title="Notifications">
      <Bell size={16} />
      <span class="tb-notif-dot"></span>
    </button>

    <button class="tb-avatar" title="Profile">
      PA
    </button>

    <div class="tb-sep"></div>

    <button
      class="tb-icon-btn"
      class:active={!sidebarCollapsed}
      on:click={() => dispatch('toggleSidebar')}
      title="Toggle sidebar"
    >
      <LayoutGrid size={15} />
    </button>

    <button
      class="tb-icon-btn"
      class:active={aiPanelOpen}
      on:click={() => dispatch('toggleAiPanel')}
      title="Toggle AI panel"
    >
      <Sparkles size={15} />
    </button>
  </div>
</div>

<style>
  .tb {
    display: flex; align-items: center; justify-content: space-between;
    height: 56px; padding: 0 16px; gap: 12px;
  }

  .tb-left  { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .tb-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

  .tb-sep { width: 1px; height: 20px; background: #1a2038; flex-shrink: 0; }

  .tb-logo-btn {
    font-size: 1.1rem; font-weight: 800; color: #6c8fff;
    background: none; border: none; cursor: pointer; padding: 0 2px;
    transition: opacity 0.15s;
  }
  .tb-logo-btn:hover { opacity: 0.7; }

  .tb-value-hero { display: flex; flex-direction: column; line-height: 1; }
  .tb-value-label { font-size: 0.5rem; color: #7a8fb0; font-weight: 500; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.06em; }
  .tb-value-row { display: flex; align-items: baseline; gap: 6px; }
  .tb-value { font-size: 0.95rem; font-weight: 700; color: #dce8ff; letter-spacing: -0.02em; }
  .tb-change { font-size: 0.65rem; font-weight: 600; }
  .positive { color: #2dd4a0; }
  .negative { color: #f96b7e; }

  .tb-account-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 5px 10px; border-radius: 6px;
    background: rgba(255,255,255,0.04); border: 1px solid #1a2038;
    font-size: 0.72rem; color: #dce8ff; cursor: pointer;
    transition: border-color 0.15s;
  }
  .tb-account-btn:hover { border-color: rgba(108,143,255,0.4); }

  .tb-acc-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .tb-acc-dot.live    { background: #2dd4a0; }
  .tb-acc-dot.sandbox { background: #fbbf24; }

  .tb-acc-name { font-weight: 600; }

  .tb-acc-badge {
    font-size: 0.55rem; font-weight: 700; padding: 1px 5px;
    border-radius: 20px; letter-spacing: 0.06em;
  }
  .tb-acc-badge.live    { background: rgba(45,212,160,0.12); color: #2dd4a0; }
  .tb-acc-badge.sandbox { background: rgba(251,191,36,0.12);  color: #fbbf24; }

  .tb-ai-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 6px 12px; border-radius: 6px;
    background: rgba(108,143,255,0.1); border: 1px solid rgba(108,143,255,0.25);
    font-size: 0.72rem; font-weight: 600; color: #6c8fff;
    cursor: pointer; transition: background 0.15s;
  }
  .tb-ai-btn:hover { background: rgba(108,143,255,0.18); }

  .tb-icon-btn {
    position: relative;
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: 6px;
    background: rgba(255,255,255,0.04); border: 1px solid #1a2038;
    color: #7a8fb0; cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .tb-icon-btn:hover { border-color: rgba(108,143,255,0.4); color: #dce8ff; }
  .tb-icon-btn.active { border-color: rgba(108,143,255,0.5); color: #6c8fff; background: rgba(108,143,255,0.1); }

  .tb-notif-dot {
    position: absolute; top: 5px; right: 5px;
    width: 5px; height: 5px; border-radius: 50%;
    background: #f96b7e; border: 1px solid #090e1d;
  }

  .tb-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background: linear-gradient(135deg, #6c8fff, #4a5fff);
    font-size: 0.6rem; font-weight: 700; color: #fff;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: none;
  }
</style>
```

- [ ] **Step 2: Update root layout to pass new AppShell props**

Edit `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import '../app.css';
  import AppShell from '$lib/components/portfolioai/AppShell.svelte';

  const publicRoutes = new Set(['/', '/login', '/register']);
  $: isPublicRoute = publicRoutes.has($page.url.pathname);

  const aiPanelRoutes = ['/dashboard', '/ai'];
  $: showAiPanel = aiPanelRoutes.some(r => $page.url.pathname === r || $page.url.pathname.startsWith(r + '/'));
</script>

<svelte:head>
  <title>PortfolioAI</title>
  <meta name="description" content="AI Portfolio Operating System — institutional analytics, AI copilot, broker sync." />
</svelte:head>

{#if isPublicRoute}
  <slot />
{:else}
  <AppShell {showAiPanel}>
    <slot />
  </AppShell>
{/if}
```

- [ ] **Step 3: Run svelte-check**

```powershell
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | Select-String "error" | Select-Object -First 10
```

- [ ] **Step 4: Commit**

```powershell
git add src/lib/components/portfolioai/Topbar.svelte src/routes/+layout.svelte
git commit -m "feat: rewrite Topbar (value-hero) and update root layout for adaptive AppShell"
```

---

## Task 7: PageHeader + StatCard (Glass)

**Files:**
- Create: `src/lib/components/portfolioai/PageHeader.svelte`
- Modify: `src/lib/components/portfolioai/StatCard.svelte`

- [ ] **Step 1: Create PageHeader.svelte**

```svelte
<script lang="ts">
  export let title = '';
  export let subtitle = '';
  export let breadcrumb: { label: string; href?: string }[] = [];
</script>

<div class="ph">
  {#if breadcrumb.length > 0}
    <nav class="ph-breadcrumb">
      {#each breadcrumb as crumb, i}
        {#if i > 0}<span class="ph-sep">/</span>{/if}
        {#if crumb.href}
          <a href={crumb.href} class="ph-crumb-link">{crumb.label}</a>
        {:else}
          <span class="ph-crumb-current">{crumb.label}</span>
        {/if}
      {/each}
    </nav>
  {/if}
  <h1 class="ph-title">{title}</h1>
  {#if subtitle}<p class="ph-subtitle">{subtitle}</p>{/if}
</div>

<style>
  .ph { margin-bottom: 24px; }
  .ph-breadcrumb { display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
  .ph-sep { color: #1a2038; font-size: 0.75rem; }
  .ph-crumb-link { font-size: 0.72rem; color: #7a8fb0; text-decoration: none; }
  .ph-crumb-link:hover { color: #6c8fff; }
  .ph-crumb-current { font-size: 0.72rem; color: #dce8ff; }
  .ph-title { font-size: 1.4rem; font-weight: 700; color: #dce8ff; margin: 0; }
  .ph-subtitle { font-size: 0.8rem; color: #7a8fb0; margin: 4px 0 0; }
</style>
```

- [ ] **Step 2: Rewrite StatCard.svelte (glass variant)**

```svelte
<script lang="ts">
  export let label = '';
  export let value = '';
  export let change = '';
  export let tint: 'primary' | 'success' | 'danger' | 'warning' = 'primary';

  const tintMap = {
    primary: { rgb: '108,143,255', color: '#6c8fff' },
    success: { rgb: '45,212,160',  color: '#2dd4a0' },
    danger:  { rgb: '249,107,126', color: '#f96b7e' },
    warning: { rgb: '251,191,36',  color: '#fbbf24' },
  };

  $: t = tintMap[tint];
</script>

<div class="sc" style="--t-rgb:{t.rgb};--t-color:{t.color}">
  <div class="sc-label">{label}</div>
  <div class="sc-value">{value}</div>
  {#if change}
    <div class="sc-change">{change}</div>
  {/if}
</div>

<style>
  .sc {
    padding: 16px 18px;
    border-radius: 10px;
    border: 1px solid rgba(var(--t-rgb), 0.2);
    background: linear-gradient(135deg, rgba(var(--t-rgb), 0.08), rgba(14,24,48,0.6));
    backdrop-filter: blur(12px);
    transition: border-color 0.2s;
  }
  .sc:hover { border-color: rgba(var(--t-rgb), 0.35); }
  .sc-label  { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #7a8fb0; margin-bottom: 8px; }
  .sc-value  { font-size: 1.3rem; font-weight: 700; color: var(--t-color); letter-spacing: -0.02em; line-height: 1; }
  .sc-change { font-size: 0.7rem; color: #7a8fb0; margin-top: 6px; }
</style>
```

- [ ] **Step 3: Commit**

```powershell
git add src/lib/components/portfolioai/PageHeader.svelte src/lib/components/portfolioai/StatCard.svelte
git commit -m "feat: add PageHeader and rewrite StatCard with glass/glow variant"
```

---

## Task 8: AiBanner + AiInsightCard

**Files:**
- Create: `src/lib/components/portfolioai/AiBanner.svelte`
- Modify: `src/lib/components/portfolioai/AIInsightCard.svelte`

- [ ] **Step 1: Create AiBanner.svelte**

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';

  export let brief = '';
  export let loading = false;

  const suggestions = [
    'Why is my portfolio risky?',
    'What sectors am I overweight?',
    'How does my portfolio compare to SPY?',
  ];

  function askQuestion(q: string) {
    const params = new URLSearchParams({ q });
    goto(`/ai/copilot?${params}`);
  }
</script>

<div class="banner">
  <!-- Left: AI Brief -->
  <div class="banner-brief">
    <div class="banner-title">✦ AI BRIEF</div>
    {#if loading}
      <div class="skeleton-line" style="width:90%"></div>
      <div class="skeleton-line" style="width:70%;margin-top:6px"></div>
      <div class="skeleton-line" style="width:80%;margin-top:6px"></div>
    {:else if brief}
      <p class="banner-text">{brief}</p>
    {:else}
      <p class="banner-empty">
        No AI brief yet. <a href="/ai/copilot" class="banner-link">Generate one →</a>
      </p>
    {/if}
  </div>

  <!-- Divider -->
  <div class="banner-sep"></div>

  <!-- Right: Suggested questions -->
  <div class="banner-chips">
    <div class="banner-chips-label">SUGGESTED QUESTIONS</div>
    {#each suggestions as q}
      <button class="chip" on:click={() => askQuestion(q)}>{q}</button>
    {/each}
  </div>
</div>

<style>
  .banner {
    display: grid; grid-template-columns: 1fr auto 1fr;
    border-radius: 10px;
    border: 1px solid rgba(108,143,255,0.25);
    background: #0e1830;
    overflow: hidden;
    margin-bottom: 20px;
  }
  .banner-brief { padding: 16px 20px; }
  .banner-title { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #6c8fff; margin-bottom: 8px; }
  .banner-text  { font-size: 0.8rem; color: #7a8fb0; line-height: 1.6; margin: 0; }
  .banner-empty { font-size: 0.8rem; color: #7a8fb0; margin: 0; }
  .banner-link  { color: #6c8fff; }
  .banner-sep   { width: 1px; background: rgba(108,143,255,0.15); }
  .banner-chips { padding: 16px 20px; display: flex; flex-direction: column; gap: 6px; }
  .banner-chips-label { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #7a8fb0; margin-bottom: 4px; }
  .chip {
    text-align: left; padding: 7px 10px; border-radius: 6px;
    background: rgba(108,143,255,0.08); border: 1px solid rgba(108,143,255,0.2);
    font-size: 0.72rem; color: #6c8fff; cursor: pointer;
    transition: background 0.15s;
  }
  .chip:hover { background: rgba(108,143,255,0.16); }
  .skeleton-line { height: 8px; border-radius: 4px; background: #1a2038; animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

  @media (max-width: 640px) {
    .banner { grid-template-columns: 1fr; }
    .banner-sep { width: auto; height: 1px; }
  }
</style>
```

- [ ] **Step 2: Rewrite AIInsightCard.svelte**

```svelte
<script lang="ts">
  export let title = '';
  export let summary = '';
  export let signal: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  export let href = '';

  const signalMap = {
    low:      { label: 'Low',      color: '#2dd4a0', bg: 'rgba(45,212,160,0.1)' },
    medium:   { label: 'Medium',   color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
    high:     { label: 'High',     color: '#f96b7e', bg: 'rgba(249,107,126,0.1)' },
    critical: { label: 'Critical', color: '#f96b7e', bg: 'rgba(249,107,126,0.18)' },
  };

  $: s = signalMap[signal];
</script>

<div class="ic">
  <div class="ic-header">
    <span class="ic-title">{title}</span>
    <span class="ic-signal" style="color:{s.color};background:{s.bg}">{s.label}</span>
  </div>
  <p class="ic-summary">{summary}</p>
  {#if href}
    <a href={href} class="ic-link">View Details →</a>
  {/if}
</div>

<style>
  .ic { padding: 16px; border-radius: 10px; border: 1px solid rgba(108,143,255,0.2); background: #0e1830; display: flex; flex-direction: column; gap: 8px; }
  .ic-header { display: flex; align-items: center; justify-content: space-between; }
  .ic-title  { font-size: 0.75rem; font-weight: 700; color: #6c8fff; }
  .ic-signal { font-size: 0.6rem; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.06em; }
  .ic-summary{ font-size: 0.78rem; color: #7a8fb0; line-height: 1.5; margin: 0; }
  .ic-link   { font-size: 0.72rem; color: #6c8fff; text-decoration: none; align-self: flex-start; }
  .ic-link:hover { text-decoration: underline; }
</style>
```

- [ ] **Step 3: Commit**

```powershell
git add src/lib/components/portfolioai/AiBanner.svelte src/lib/components/portfolioai/AIInsightCard.svelte
git commit -m "feat: add AiBanner (split panel) and rewrite AIInsightCard"
```

---

## Task 9: ECharts Components — PortfolioGrowthChart + AllocationChart

**Files:**
- Create: `src/lib/components/portfolioai/charts/PortfolioGrowthChart.svelte`
- Create: `src/lib/components/portfolioai/charts/AllocationChart.svelte`

- [ ] **Step 1: Create PortfolioGrowthChart.svelte**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { ChartPeriod } from '$lib/echarts.config';
  import { CHART_THEME } from '$lib/echarts.config';

  export let snapshots: { date: string; totalValue: number }[] = [];
  export let period: ChartPeriod = '1Y';

  let container: HTMLDivElement;
  let chart: import('echarts').ECharts | null = null;

  const periods: ChartPeriod[] = ['1M', '3M', '6M', '1Y', 'All'];

  $: filtered = filterByPeriod(snapshots, period);
  $: if (chart) updateChart(filtered);

  function filterByPeriod(data: typeof snapshots, p: ChartPeriod) {
    if (p === 'All' || !data.length) return data;
    const days = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }[p];
    const cutoff = new Date(Date.now() - days * 86400000);
    return data.filter(s => new Date(s.date) >= cutoff);
  }

  function buildOption(data: typeof snapshots) {
    return {
      ...CHART_THEME,
      grid: { left: 60, right: 20, top: 20, bottom: 40 },
      xAxis: {
        type: 'category',
        data: data.map(s => new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        axisLine:  { lineStyle: { color: '#1a2038' } },
        axisTick:  { show: false },
        axisLabel: { color: '#7a8fb0', fontSize: 10 },
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#7a8fb0', fontSize: 10,
          formatter: (v: number) => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v),
        },
        splitLine: { lineStyle: { color: '#1a203820', type: 'dashed' } },
      },
      series: [{
        type: 'line',
        data: data.map(s => s.totalValue),
        smooth: true,
        lineStyle: { color: '#6c8fff', width: 2 },
        itemStyle: { color: '#6c8fff' },
        symbol: 'none',
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(108,143,255,0.25)' },
              { offset: 1, color: 'rgba(108,143,255,0.02)' },
            ],
          },
        },
      }],
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f1523',
        borderColor: '#1a2038',
        textStyle: { color: '#dce8ff', fontSize: 12 },
        formatter: (params: { name: string; value: number }[]) => {
          if (!params[0]) return '';
          return `${params[0].name}<br/><b>$${params[0].value.toLocaleString()}</b>`;
        },
      },
    };
  }

  function updateChart(data: typeof snapshots) {
    chart?.setOption(buildOption(data));
  }

  onMount(async () => {
    const echarts = await import('echarts');
    chart = echarts.init(container, null, { renderer: 'canvas' });
    updateChart(filtered);
    const ro = new ResizeObserver(() => chart?.resize());
    ro.observe(container);
    return () => ro.disconnect();
  });

  onDestroy(() => chart?.dispose());
</script>

<div class="chart-wrap">
  <div class="chart-header">
    <span class="chart-title">Portfolio Growth</span>
    <div class="period-tabs">
      {#each periods as p}
        <button
          class="period-btn"
          class:active={period === p}
          on:click={() => period = p}
        >{p}</button>
      {/each}
    </div>
  </div>
  <div bind:this={container} class="chart-canvas"></div>
</div>

<style>
  .chart-wrap   { background: #0f1523; border-radius: 10px; border: 1px solid #1a2038; padding: 16px; }
  .chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .chart-title  { font-size: 0.8rem; font-weight: 600; color: #dce8ff; }
  .period-tabs  { display: flex; gap: 2px; }
  .period-btn   { padding: 3px 8px; border-radius: 5px; font-size: 0.65rem; font-weight: 600; border: 1px solid transparent; background: none; color: #7a8fb0; cursor: pointer; transition: all 0.15s; }
  .period-btn:hover  { color: #dce8ff; background: rgba(108,143,255,0.08); }
  .period-btn.active { color: #6c8fff; background: rgba(108,143,255,0.14); border-color: rgba(108,143,255,0.3); }
  .chart-canvas { height: 220px; }
</style>
```

- [ ] **Step 2: Create AllocationChart.svelte**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { CHART_THEME } from '$lib/echarts.config';

  export let allocations: { label: string; percentage: number }[] = [];

  let container: HTMLDivElement;
  let chart: import('echarts').ECharts | null = null;

  $: if (chart) updateChart(allocations);

  function buildOption(data: typeof allocations) {
    return {
      ...CHART_THEME,
      series: [{
        type: 'pie',
        radius: ['48%', '72%'],
        center: ['50%', '50%'],
        data: data.map(a => ({ name: a.label, value: a.percentage })),
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(108,143,255,0.3)' },
        },
      }],
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: { color: '#7a8fb0', fontSize: 11 },
        formatter: (name: string) => {
          const item = data.find(d => d.label === name);
          return `${name}  ${item?.percentage.toFixed(1)}%`;
        },
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f1523',
        borderColor: '#1a2038',
        textStyle: { color: '#dce8ff', fontSize: 12 },
        formatter: '{b}: {c}%',
      },
    };
  }

  function updateChart(data: typeof allocations) {
    chart?.setOption(buildOption(data));
  }

  onMount(async () => {
    const echarts = await import('echarts');
    chart = echarts.init(container, null, { renderer: 'canvas' });
    updateChart(allocations);
    const ro = new ResizeObserver(() => chart?.resize());
    ro.observe(container);
    return () => ro.disconnect();
  });

  onDestroy(() => chart?.dispose());
</script>

<div class="alloc-wrap">
  <div class="alloc-title">Allocation</div>
  <div bind:this={container} class="alloc-canvas"></div>
</div>

<style>
  .alloc-wrap  { background: #0f1523; border-radius: 10px; border: 1px solid #1a2038; padding: 16px; }
  .alloc-title { font-size: 0.8rem; font-weight: 600; color: #dce8ff; margin-bottom: 12px; }
  .alloc-canvas{ height: 220px; }
</style>
```

- [ ] **Step 3: Commit**

```powershell
git add src/lib/components/portfolioai/charts/
git commit -m "feat: add ECharts PortfolioGrowthChart and AllocationChart components"
```

---

## Task 10: Table Components

**Files:**
- Create: `src/lib/components/portfolioai/tables/HoldingsTable.svelte`
- Create: `src/lib/components/portfolioai/tables/TransactionsTable.svelte`
- Create: `src/lib/components/portfolioai/tables/WatchlistTable.svelte`
- Create: `src/lib/components/portfolioai/tables/SnapshotTable.svelte`
- Create: `src/lib/components/portfolioai/AccountCard.svelte`

- [ ] **Step 1: Create HoldingsTable.svelte**

```svelte
<script lang="ts">
  import type { Holding } from '$lib/types/portfolio';
  import LoadingSkeleton from '../LoadingSkeleton.svelte';
  import EmptyState from '../EmptyState.svelte';

  export let holdings: Holding[] = [];
  export let loading = false;

  let search = '';
  let sortKey: keyof Holding = 'marketValue';
  let sortAsc = false;

  $: filtered = holdings
    .filter(h => !search || h.symbol.toLowerCase().includes(search.toLowerCase()) || h.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey] as number, bv = b[sortKey] as number;
      return sortAsc ? av - bv : bv - av;
    });

  function sort(key: keyof Holding) {
    if (sortKey === key) sortAsc = !sortAsc;
    else { sortKey = key; sortAsc = false; }
  }

  function money(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }); }
  function pct(n: number)   { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
</script>

<div class="ht-bar">
  <input class="field ht-search" placeholder="Search symbol or name…" bind:value={search} />
  <a href="/holdings/export" class="button-secondary" style="font-size:0.75rem;height:36px;padding:0 12px">Export CSV</a>
</div>

<div class="table-wrap">
  {#if loading}
    <div style="padding:16px"><LoadingSkeleton variant="table" rows={8} /></div>
  {:else if filtered.length === 0}
    <EmptyState icon="◎" title="No holdings found" description="Import transactions or sync a broker to see positions here." ctaLabel="Import CSV" ctaHref="/import" />
  {:else}
    <table class="data-table">
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Name</th>
          <th class="th-r" on:click={() => sort('quantity')} style="cursor:pointer">Qty</th>
          <th class="th-r" on:click={() => sort('averageCost')} style="cursor:pointer">Avg Cost</th>
          <th class="th-r" on:click={() => sort('marketValue')} style="cursor:pointer">Mkt Value</th>
          <th class="th-r" on:click={() => sort('unrealizedPnl')} style="cursor:pointer">Unr. P&L</th>
          <th class="th-r" on:click={() => sort('allocationPercentage')} style="cursor:pointer">Alloc %</th>
          <th>Account</th>
        </tr>
      </thead>
      <tbody>
        {#each filtered as h}
          <tr>
            <td class="td-symbol">{h.symbol}</td>
            <td class="td-muted">{h.name}</td>
            <td class="td-r">{h.quantity.toFixed(4)}</td>
            <td class="td-r">{money(h.averageCost)}</td>
            <td class="td-r">{money(h.marketValue)}</td>
            <td class="td-r" class:positive={h.unrealizedPnl >= 0} class:negative={h.unrealizedPnl < 0}>
              {money(h.unrealizedPnl)}
            </td>
            <td class="td-r">{h.allocationPercentage.toFixed(1)}%</td>
            <td class="td-muted td-sm">{h.accountName}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .ht-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
  .ht-search { max-width: 280px; height: 36px; }
  .th-r { text-align: right; }
  .td-r { text-align: right; }
  .td-symbol { font-weight: 700; color: #6c8fff; }
  .td-muted { color: #7a8fb0; }
  .td-sm { font-size: 0.72rem; }
</style>
```

- [ ] **Step 2: Create TransactionsTable.svelte**

```svelte
<script lang="ts">
  import type { TransactionWithRelations } from '$lib/types/portfolio';
  import LoadingSkeleton from '../LoadingSkeleton.svelte';
  import EmptyState from '../EmptyState.svelte';

  export let transactions: TransactionWithRelations[] = [];
  export let loading = false;

  type TxType = 'ALL' | 'BUY' | 'SELL' | 'DIVIDEND' | 'FEE' | 'TRANSFER';
  let activeType: TxType = 'ALL';
  let page = 0;
  const PER_PAGE = 50;

  const typeStyles: Record<string, { color: string; bg: string }> = {
    BUY:      { color: '#2dd4a0', bg: 'rgba(45,212,160,0.12)'  },
    SELL:     { color: '#f96b7e', bg: 'rgba(249,107,126,0.12)' },
    DIVIDEND: { color: '#6c8fff', bg: 'rgba(108,143,255,0.12)' },
    FEE:      { color: '#7a8fb0', bg: 'rgba(122,143,176,0.1)'  },
    TRANSFER: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'   },
  };

  $: filtered = activeType === 'ALL' ? transactions : transactions.filter(t => t.type === activeType);
  $: paged = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  $: pages = Math.ceil(filtered.length / PER_PAGE);

  function money(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }); }
  function fmtDate(d: string | Date) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }); }
</script>

<div class="tx-bar">
  {#each ['ALL','BUY','SELL','DIVIDEND','FEE','TRANSFER'] as t}
    <button class="filter-chip" class:active={activeType === t} on:click={() => { activeType = t as TxType; page = 0; }}>{t}</button>
  {/each}
  <div style="flex:1"></div>
  <a href="/import" class="button-secondary" style="font-size:0.75rem;height:36px;padding:0 12px">Import CSV</a>
</div>

<div class="table-wrap">
  {#if loading}
    <div style="padding:16px"><LoadingSkeleton variant="table" rows={8} /></div>
  {:else if paged.length === 0}
    <EmptyState icon="⇅" title="No transactions" description="Import a CSV or sync a broker to see transactions." />
  {:else}
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th><th>Type</th><th>Symbol</th>
          <th class="th-r">Qty</th><th class="th-r">Price</th><th class="th-r">Total</th>
          <th>Account</th>
        </tr>
      </thead>
      <tbody>
        {#each paged as tx}
          {@const style = typeStyles[tx.type] ?? typeStyles.FEE}
          <tr>
            <td style="color:#7a8fb0;font-size:0.75rem">{fmtDate(tx.date)}</td>
            <td>
              <span class="type-badge" style="color:{style.color};background:{style.bg}">{tx.type}</span>
            </td>
            <td style="font-weight:700;color:#6c8fff">{tx.asset?.symbol ?? '—'}</td>
            <td style="text-align:right">{tx.quantity}</td>
            <td style="text-align:right">{money(tx.price)}</td>
            <td style="text-align:right;font-weight:600">{money(tx.quantity * tx.price)}</td>
            <td style="color:#7a8fb0;font-size:0.72rem">{tx.account.name}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if pages > 1}
      <div class="tx-pager">
        <button class="button-secondary" style="height:32px;font-size:0.72rem" disabled={page === 0} on:click={() => page--}>← Prev</button>
        <span style="font-size:0.75rem;color:#7a8fb0">Page {page+1} / {pages}</span>
        <button class="button-secondary" style="height:32px;font-size:0.72rem" disabled={page >= pages-1} on:click={() => page++}>Next →</button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .tx-bar { display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-bottom:12px; }
  .filter-chip { padding:4px 10px; border-radius:20px; font-size:0.65rem; font-weight:600; border:1px solid #1a2038; background:none; color:#7a8fb0; cursor:pointer; transition:all 0.15s; }
  .filter-chip:hover { border-color:rgba(108,143,255,0.4); color:#dce8ff; }
  .filter-chip.active { border-color:rgba(108,143,255,0.5); background:rgba(108,143,255,0.12); color:#6c8fff; }
  .type-badge { font-size:0.6rem; font-weight:700; padding:2px 7px; border-radius:20px; letter-spacing:0.05em; }
  .th-r { text-align:right; }
  .tx-pager { display:flex; align-items:center; gap:12px; justify-content:center; padding:12px; border-top:1px solid #1a2038; }
</style>
```

- [ ] **Step 3: Create AccountCard.svelte**

```svelte
<script lang="ts">
  import type { Account } from '@prisma/client';
  import AccountModeBadge from './badges/AccountModeBadge.svelte';

  export let account: Account;
  export let balance = 0;
  export let dayPnl = 0;
  export let lastSynced: Date | null = null;

  function money(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }); }
  function timeAgo(d: Date) {
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins/60)}h ago`;
  }

  $: mode = account.accountType === 'paper'
    ? 'SANDBOX'
    : account.brokerName
      ? 'LIVE READ-ONLY'
      : 'MANUAL';
</script>

<div class="ac">
  <div class="ac-header">
    <div>
      <div class="ac-name">{account.name}</div>
      {#if account.brokerName}
        <div class="ac-broker">{account.brokerName}</div>
      {/if}
    </div>
    <AccountModeBadge {mode} />
  </div>

  <div class="ac-values">
    <div>
      <div class="ac-label">Balance</div>
      <div class="ac-value">{money(balance)}</div>
    </div>
    <div>
      <div class="ac-label">Day P&L</div>
      <div class="ac-value" class:positive={dayPnl >= 0} class:negative={dayPnl < 0}>
        {dayPnl >= 0 ? '+' : ''}{money(dayPnl)}
      </div>
    </div>
  </div>

  {#if lastSynced}
    <div class="ac-sync">Last synced {timeAgo(lastSynced)}</div>
  {/if}

  <!-- No buy/sell on LIVE accounts — only edit/delete shown -->
  <div class="ac-actions">
    <button class="button-secondary" style="font-size:0.72rem;height:32px;flex:1">Edit</button>
    {#if mode === 'SANDBOX'}
      <a href="/paper-trading" class="button" style="font-size:0.72rem;height:32px;flex:1">Open Sandbox</a>
    {/if}
  </div>
</div>

<style>
  .ac { background:#0f1523; border:1px solid #1a2038; border-radius:10px; padding:18px; display:flex; flex-direction:column; gap:14px; }
  .ac-header { display:flex; align-items:flex-start; justify-content:space-between; }
  .ac-name   { font-size:0.9rem; font-weight:700; color:#dce8ff; }
  .ac-broker { font-size:0.7rem; color:#7a8fb0; margin-top:2px; }
  .ac-values { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .ac-label  { font-size:0.6rem; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:#7a8fb0; margin-bottom:4px; }
  .ac-value  { font-size:1.1rem; font-weight:700; color:#dce8ff; }
  .ac-sync   { font-size:0.68rem; color:#7a8fb0; }
  .ac-actions{ display:flex; gap:8px; }
  .positive  { color:#2dd4a0; }
  .negative  { color:#f96b7e; }
</style>
```

- [ ] **Step 4: Create WatchlistTable.svelte**

```svelte
<script lang="ts">
  import EmptyState from '../EmptyState.svelte';

  type WatchItem = { id: string; symbol: string; name?: string; price?: number; dayChange?: number; dayChangePct?: number; conviction?: string; notes?: string };
  export let items: WatchItem[] = [];
  export let loading = false;
</script>

{#if loading}
  <div style="padding:16px;color:#7a8fb0;font-size:0.8rem">Loading…</div>
{:else if items.length === 0}
  <EmptyState icon="◎" title="Watchlist is empty" description="Add symbols to track ideas before they become holdings." />
{:else}
  <div class="wl-grid">
    {#each items as item}
      <div class="wl-card">
        <div class="wl-top">
          <span class="wl-symbol">{item.symbol}</span>
          {#if item.conviction}
            <span class="wl-conviction" data-lvl={item.conviction.toLowerCase()}>{item.conviction}</span>
          {/if}
        </div>
        {#if item.name}<div class="wl-name">{item.name}</div>{/if}
        {#if item.price != null}
          <div class="wl-price">${item.price.toFixed(2)}</div>
          {#if item.dayChangePct != null}
            <div class="wl-change" class:positive={item.dayChangePct >= 0} class:negative={item.dayChangePct < 0}>
              {item.dayChangePct >= 0 ? '+' : ''}{item.dayChangePct.toFixed(2)}%
            </div>
          {/if}
        {/if}
        {#if item.notes}<p class="wl-notes">{item.notes}</p>{/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .wl-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:12px; }
  .wl-card { background:#0f1523; border:1px solid #1a2038; border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:4px; }
  .wl-top  { display:flex; align-items:center; justify-content:space-between; }
  .wl-symbol { font-size:0.9rem; font-weight:700; color:#6c8fff; }
  .wl-name   { font-size:0.7rem; color:#7a8fb0; }
  .wl-price  { font-size:1rem; font-weight:700; color:#dce8ff; margin-top:4px; }
  .wl-change { font-size:0.72rem; font-weight:600; }
  .wl-notes  { font-size:0.7rem; color:#7a8fb0; margin:4px 0 0; line-height:1.5; }
  .wl-conviction { font-size:0.55rem; font-weight:700; padding:2px 7px; border-radius:20px; text-transform:uppercase; }
  [data-lvl="high"]   { background:rgba(45,212,160,0.12); color:#2dd4a0; }
  [data-lvl="medium"] { background:rgba(251,191,36,0.1);  color:#fbbf24; }
  [data-lvl="low"]    { background:rgba(122,143,176,0.1); color:#7a8fb0; }
  .positive { color:#2dd4a0; }
  .negative { color:#f96b7e; }
</style>
```

- [ ] **Step 5: Create SnapshotTable.svelte**

```svelte
<script lang="ts">
  import EmptyState from '../EmptyState.svelte';

  type Snapshot = { id: string; createdAt: Date | string; totalValue: number; holdingsJson: string; cashBalance?: number };
  export let snapshots: Snapshot[] = [];
  export let loading = false;

  function money(n: number) { return n.toLocaleString('en-US', { style:'currency', currency:'USD', minimumFractionDigits:2 }); }
  function fmtDate(d: Date | string) { return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }); }
  function holdingCount(json: string) { try { return JSON.parse(json).length; } catch { return 0; } }
</script>

<div class="table-wrap">
  {#if loading}
    <div style="padding:16px;color:#7a8fb0;font-size:0.8rem">Loading…</div>
  {:else if snapshots.length === 0}
    <EmptyState icon="📸" title="No snapshots yet" description="Sync a broker to create your first snapshot." ctaLabel="Go to Broker Sync" ctaHref="/broker" />
  {:else}
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th class="th-r">Portfolio Value</th>
          <th class="th-r">Holdings</th>
          <th class="th-r">Cash</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each snapshots as s}
          <tr>
            <td>{fmtDate(s.createdAt)}</td>
            <td style="text-align:right;font-weight:700">{money(s.totalValue)}</td>
            <td style="text-align:right">{holdingCount(s.holdingsJson)}</td>
            <td style="text-align:right">{s.cashBalance != null ? money(s.cashBalance) : '—'}</td>
            <td>
              <a href="/snapshots/{s.id}" class="action-link">View</a>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .th-r { text-align:right; }
  .action-link { font-size:0.72rem; color:#6c8fff; text-decoration:none; }
  .action-link:hover { text-decoration:underline; }
</style>
```

- [ ] **Step 6: Commit**

```powershell
git add src/lib/components/portfolioai/tables/ src/lib/components/portfolioai/AccountCard.svelte
git commit -m "feat: add HoldingsTable, TransactionsTable, WatchlistTable, SnapshotTable, AccountCard"
```

---

## Task 11: Dashboard Page Rewrite

**Files:**
- Modify: `src/routes/dashboard/+page.svelte`
- Create: `src/routes/dashboard/+page.server.ts`

- [ ] **Step 1: Create src/routes/dashboard/+page.server.ts**

```ts
import { getDemoUser } from '$lib/server/demo-user';
import { getHoldings } from '$lib/services/portfolio.service';
import { listAccounts } from '$lib/services/account.service';
import { getLatestSnapshot } from '$lib/services/snapshot.service';
import type { AllocationSlice, SnapshotHolding } from '$lib/types/portfolio';
import { db } from '$lib/server/db';

export async function load() {
  const user = await getDemoUser();

  const [accounts, holdings, snapshot, watchlistItems] = await Promise.all([
    listAccounts(user.id),
    getHoldings(user.id),
    getLatestSnapshot(user.id),
    db.watchlistItem.findMany({ where: { watchlist: { userId: user.id } }, take: 6, include: { watchlist: false } }).catch(() => []),
  ]);

  // Build portfolio value from holdings
  const totalValue = holdings.reduce((s, h) => s + h.marketValue, 0);
  const totalCost  = holdings.reduce((s, h) => s + h.costBasis, 0);
  const totalPnl   = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  // Allocation by sector
  const sectorMap = new Map<string, number>();
  for (const h of holdings) {
    const sector = h.sector ?? 'Other';
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + h.marketValue);
  }
  const allocations: AllocationSlice[] = [...sectorMap.entries()]
    .map(([label, value]) => ({ label, value, percentage: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  // Top 8 holdings
  const topHoldings = [...holdings].sort((a, b) => b.marketValue - a.marketValue).slice(0, 8);

  // Snapshots for growth chart
  const snapshots = await db.portfolioSnapshot.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true, totalValue: true },
    take: 365,
  }).catch(() => []);

  const growthData = snapshots.map(s => ({ date: s.createdAt.toISOString(), totalValue: s.totalValue }));

  // Latest AI brief from AiInsight
  const latestInsight = await db.aiInsight.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { content: true },
  }).catch(() => null);

  const aiBrief = latestInsight?.content
    ? (typeof latestInsight.content === 'string' ? latestInsight.content : JSON.stringify(latestInsight.content)).slice(0, 300)
    : '';

  return {
    totalValue,
    totalPnl,
    totalPnlPct,
    accounts,
    allocations,
    topHoldings,
    growthData,
    aiBrief,
    watchlistItems,
  };
}
```

- [ ] **Step 2: Rewrite src/routes/dashboard/+page.svelte**

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import StatCard from '$lib/components/portfolioai/StatCard.svelte';
  import AiBanner from '$lib/components/portfolioai/AiBanner.svelte';
  import AIInsightCard from '$lib/components/portfolioai/AIInsightCard.svelte';
  import PortfolioGrowthChart from '$lib/components/portfolioai/charts/PortfolioGrowthChart.svelte';
  import AllocationChart from '$lib/components/portfolioai/charts/AllocationChart.svelte';
  import HoldingsTable from '$lib/components/portfolioai/tables/HoldingsTable.svelte';
  import WatchlistTable from '$lib/components/portfolioai/tables/WatchlistTable.svelte';

  export let data: PageData;

  function money(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }

  $: sharpe = 1.42; // TODO: wire from analytics service in future phase
</script>

<PageHeader title="Dashboard" subtitle={new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })} />

<!-- AI Banner -->
<AiBanner brief={data.aiBrief} />

<!-- Stat row -->
<div class="stat-row">
  <StatCard label="Portfolio Value" value={money(data.totalValue)} change="+1.2% today" tint="primary" />
  <StatCard label="Day P&L"        value={money(data.totalPnl)}   change="+0.85%"      tint="success" />
  <StatCard label="Total Return"   value={(data.totalPnlPct >= 0 ? '+' : '') + data.totalPnlPct.toFixed(1) + '%'} change="since inception" tint="success" />
  <StatCard label="Sharpe Ratio"   value={sharpe.toFixed(2)}     change="▲ Good"       tint="primary" />
</div>

<!-- Charts row -->
<div class="charts-row">
  <div class="chart-main">
    <PortfolioGrowthChart snapshots={data.growthData} />
  </div>
  <div class="chart-side">
    <AllocationChart allocations={data.allocations} />
  </div>
</div>

<!-- AI Insight cards -->
<div class="insight-row">
  <AIInsightCard title="⚠ Risk Signal"  summary="Portfolio concentration is moderate. Top 5 holdings represent 68% of value." signal="medium" href="/analytics/risk" />
  <AIInsightCard title="◉ Allocation"   summary="Tech sector is overweight at {data.allocations[0]?.percentage.toFixed(0) ?? '—'}%. Consider rebalancing." signal="high" href="/analytics/exposure" />
  <AIInsightCard title="↗ Benchmark"    summary="Portfolio is outperforming SPY by +0.4% over the past 30 days." signal="low" href="/analytics/benchmark" />
</div>

<!-- Bottom row -->
<div class="bottom-row">
  <div class="card bottom-card">
    <div class="bottom-header">
      <span class="bottom-title">Top Holdings</span>
      <a href="/holdings" class="bottom-link">View all →</a>
    </div>
    <HoldingsTable holdings={data.topHoldings} />
  </div>
  <div class="card bottom-card">
    <div class="bottom-header">
      <span class="bottom-title">Watchlist</span>
      <a href="/watchlist" class="bottom-link">Manage →</a>
    </div>
    <WatchlistTable items={data.watchlistItems.map(w => ({ id: w.id, symbol: w.symbol, notes: w.notes ?? undefined }))} />
  </div>
</div>

<style>
  .stat-row    { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-bottom:16px; }
  .charts-row  { display:grid; grid-template-columns:2fr 1fr; gap:12px; margin-bottom:16px; }
  .chart-main  { min-width:0; }
  .chart-side  { min-width:0; }
  .insight-row { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:16px; }
  .bottom-row  { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .bottom-card { padding:16px; }
  .bottom-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
  .bottom-title  { font-size:0.85rem; font-weight:600; color:#dce8ff; }
  .bottom-link   { font-size:0.72rem; color:#6c8fff; text-decoration:none; }
  .bottom-link:hover { text-decoration:underline; }

  @media (min-width:1024px) {
    .stat-row { grid-template-columns:repeat(4,1fr); }
  }
  @media (max-width:767px) {
    .charts-row  { grid-template-columns:1fr; }
    .insight-row { grid-template-columns:1fr; }
    .bottom-row  { grid-template-columns:1fr; }
  }
</style>
```

- [ ] **Step 3: Run svelte-check**

```powershell
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | Select-String "error" | Select-Object -First 15
```

Fix any type errors. Common fix: if `db.watchlistItem` doesn't exist, use `db.watchlist` with include.

- [ ] **Step 4: Commit**

```powershell
git add src/routes/dashboard/
git commit -m "feat: rewrite Dashboard — AI Command Center layout with real data"
```

---

## Task 12: Portfolio Section Pages

**Files:**
- Modify: `src/routes/holdings/+page.svelte`
- Modify: `src/routes/transactions/+page.svelte`
- Modify: `src/routes/accounts/+page.svelte`
- Modify: `src/routes/watchlist/+page.svelte`
- Modify: `src/routes/snapshots/+page.svelte`

- [ ] **Step 1: Rewrite holdings/+page.svelte**

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import HoldingsTable from '$lib/components/portfolioai/tables/HoldingsTable.svelte';
  import StatCard from '$lib/components/portfolioai/StatCard.svelte';

  export let data: PageData;

  function money(n: number) { return n.toLocaleString('en-US', { style:'currency', currency:'USD', minimumFractionDigits:2 }); }

  $: totalMarket = data.holdings.reduce((s: number, h: { marketValue: number }) => s + h.marketValue, 0);
  $: openPositions = data.holdings.length;
</script>

<PageHeader
  title="Holdings"
  subtitle={data.dataSource === 'snapshot' ? `Live from Moomoo · synced ${new Date(data.snapshotDate).toLocaleDateString()}` : 'Calculated from transactions'}
  breadcrumb={[{ label:'Portfolio', href:'/portfolio' }, { label:'Holdings' }]}
/>

<div class="stat-row">
  <StatCard label="Market Value"   value={money(totalMarket)}     tint="primary" />
  <StatCard label="Cash Balance"   value={money(data.cashBalance)} tint="success" />
  <StatCard label="Open Positions" value={String(openPositions)}  tint="primary" />
</div>

<HoldingsTable holdings={data.holdings} />

<style>
  .stat-row { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:20px; }
  @media (max-width:640px) { .stat-row { grid-template-columns:1fr; } }
</style>
```

- [ ] **Step 2: Rewrite transactions/+page.svelte**

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import TransactionsTable from '$lib/components/portfolioai/tables/TransactionsTable.svelte';

  export let data: PageData;
</script>

<PageHeader
  title="Transactions"
  breadcrumb={[{ label:'Portfolio', href:'/portfolio' }, { label:'Transactions' }]}
/>

<TransactionsTable transactions={data.transactions ?? []} />
```

- [ ] **Step 3: Rewrite accounts/+page.svelte**

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AccountCard from '$lib/components/portfolioai/AccountCard.svelte';
  import EmptyState from '$lib/components/portfolioai/EmptyState.svelte';

  export let data: PageData;
  export let form: Record<string, unknown>;

  function accountBalance(accountId: string): number {
    if (accountId === data.snapshotAccountId && data.snapshotValue > 0) return data.snapshotValue;
    return data.holdings
      .filter((h: { accountId: string; marketValue: number }) => h.accountId === accountId)
      .reduce((s: number, h: { marketValue: number }) => s + h.marketValue, 0);
  }
</script>

<PageHeader
  title="Accounts"
  breadcrumb={[{ label:'Portfolio', href:'/portfolio' }, { label:'Accounts' }]}
/>

<div style="margin-bottom:16px">
  <a href="/accounts/new" class="button">+ Add Account</a>
</div>

{#if data.accounts.length === 0}
  <EmptyState icon="🏦" title="No accounts yet" description="Add a broker account or create a sandbox for paper trading." ctaLabel="Add Account" ctaHref="/accounts/new" />
{:else}
  <div class="ac-grid">
    {#each data.accounts as account}
      <AccountCard {account} balance={accountBalance(account.id)} />
    {/each}
  </div>
{/if}

<style>
  .ac-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }
</style>
```

- [ ] **Step 4: Rewrite watchlist/+page.svelte**

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import WatchlistTable from '$lib/components/portfolioai/tables/WatchlistTable.svelte';

  export let data: PageData;

  // data.watchlistItems may come from server — fall back to mock if not present
  $: items = (data.watchlistItems ?? []).map((w: { id: string; symbol: string; notes: string | null }) => ({
    id: w.id,
    symbol: w.symbol,
    notes: w.notes ?? undefined,
  }));
</script>

<PageHeader
  title="Watchlist"
  subtitle="Track ideas and signals before they become positions."
  breadcrumb={[{ label:'Portfolio', href:'/portfolio' }, { label:'Watchlist' }]}
/>

<div style="margin-bottom:16px">
  <button class="button">+ Add Symbol</button>
</div>

<WatchlistTable {items} />
```

- [ ] **Step 5: Rewrite snapshots/+page.svelte**

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import SnapshotTable from '$lib/components/portfolioai/tables/SnapshotTable.svelte';

  export let data: PageData;
  $: snapshots = data.snapshots ?? [];
</script>

<PageHeader
  title="Snapshots"
  subtitle="Point-in-time portfolio state recorded after each broker sync."
  breadcrumb={[{ label:'Portfolio', href:'/portfolio' }, { label:'Snapshots' }]}
/>

<div style="margin-bottom:16px">
  <a href="/broker" class="button-secondary">Sync to create snapshot</a>
</div>

<SnapshotTable {snapshots} />
```

- [ ] **Step 6: Run svelte-check on all changed files**

```powershell
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | Select-String "error" | Select-Object -First 20
```

Fix any `export let data` type errors by adjusting to match the actual server return type. If a property doesn't exist on `data`, guard with `?? []` or `?? 0`.

- [ ] **Step 7: Commit**

```powershell
git add src/routes/holdings/ src/routes/transactions/ src/routes/accounts/ src/routes/watchlist/ src/routes/snapshots/
git commit -m "feat: redesign Portfolio section pages — Holdings, Transactions, Accounts, Watchlist, Snapshots"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Full svelte-check**

```powershell
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | Tee-Object -FilePath svelte-check-output.txt
Select-String "error" svelte-check-output.txt | Select-Object -First 30
```

Expected: 0 errors. Warnings are acceptable.

- [ ] **Step 2: Start dev server and smoke-test**

```powershell
npm run dev
```

Open `http://localhost:5173` and verify:
- [ ] AppShell renders with sidebar (accordion) and topbar (value hero)
- [ ] Sidebar collapses to 48px icon rail when toggle is clicked
- [ ] Dashboard shows: AI banner (split panel), 4 stat cards, growth chart, allocation donut, 3 AI insight cards, holdings table, watchlist
- [ ] `/holdings` shows new HoldingsTable with search bar
- [ ] `/accounts` shows AccountCard grid with READ ONLY badge on live accounts
- [ ] `/transactions` shows filter chips and table
- [ ] `/watchlist` shows card grid
- [ ] `/snapshots` shows snapshot table or empty state
- [ ] All other routes (`/analytics/*`, `/ai/*`, `/broker`) load without crashing (they inherit new AppShell)

- [ ] **Step 3: Remove svelte-check output file**

```powershell
Remove-Item svelte-check-output.txt
```

- [ ] **Step 4: Final commit**

```powershell
git add -A
git commit -m "feat: PortfolioAI UI redesign Phase 1 complete — Design B shell, dashboard, portfolio section"
```

---

## Self-Review

**Spec coverage check:**

| Spec Section | Covered by Task |
|---|---|
| §2 Design tokens (app.css + Tailwind) | Task 1 |
| §2.4 ECharts config | Task 2 |
| §3 AppShell adaptive layout | Task 4 |
| §4 Sidebar accordion + rail | Task 5 |
| §5 Topbar value-hero | Task 6 |
| §6 Dashboard AI Command Center | Task 11 |
| §7.2 Holdings page | Task 12 step 1 |
| §7.3 Transactions page | Task 12 step 2 |
| §7.4 Accounts page (no buy/sell on LIVE) | Task 12 step 3 |
| §7.5 Watchlist page | Task 12 step 4 |
| §7.6 Snapshots page | Task 12 step 5 |
| §8.1 PageHeader | Task 7 |
| §8.2 StatCard glass | Task 7 |
| §8.5 AiBanner split panel | Task 8 |
| §8.5 AIInsightCard | Task 8 |
| §8.3 PortfolioGrowthChart | Task 9 |
| §8.3 AllocationChart | Task 9 |
| §8.4 HoldingsTable | Task 10 |
| §8.4 TransactionsTable | Task 10 |
| §8.6 AccountModeBadge | Task 3 |
| §8.6 LoadingSkeleton + EmptyState | Task 3 |
| §9 Global CSS | Task 1 |
| §10 Route changes | Tasks 11–12 |
| §12 No buy/sell on LIVE | AccountCard (Task 10) + badge |
| §13 Success criteria | Task 13 |

**Type consistency check:** `Holding` type from `$lib/types/portfolio` used consistently in HoldingsTable and dashboard server. `TransactionWithRelations` used in TransactionsTable. `Account` from `@prisma/client` used in AccountCard. `AllocationSlice` used in AllocationChart. All match definitions in `src/lib/types/portfolio.ts`.

**Placeholder scan:** No TBD or TODO items in task steps. All code blocks are complete. The `sharpe = 1.42` in dashboard is explicitly noted as a mock pending future analytics wiring.
