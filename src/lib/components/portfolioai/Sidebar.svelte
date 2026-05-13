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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyComponent = new (...args: any[]) => any;
  type NavItem = { label: string; href: string };
  type NavGroup = {
    id: string;
    label: string;
    icon: AnyComponent;
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
