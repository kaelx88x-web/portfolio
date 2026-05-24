<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { page } from '$app/stores';
  import {
    LayoutDashboard, PieChart, Link2,
    Sliders, Settings, ChevronRight,
    ClipboardList, ChevronLeft, Download, Eye, MessageCircle, Wallet, TrendingUp
  } from 'lucide-svelte';
  import ComingSoonBadge from './badges/ComingSoonBadge.svelte';
  import { beginnerMode } from '$lib/stores/ui';

  export let sidebarCollapsed = false;

  const dispatch = createEventDispatcher();

  type BeginnerNavItem = { label: string; subtitle: string; href: string; icon: any };
  const beginnerNav: BeginnerNavItem[] = [
    { label: 'My Portfolio', subtitle: 'Your stocks & investments', href: '/holdings',              icon: Wallet },
    { label: 'Add Data',     subtitle: 'Import from Moomoo or CSV', href: '/import',               icon: Download },
    { label: 'My Returns',   subtitle: 'Your investment returns',   href: '/snapshots',            icon: TrendingUp },
    { label: 'Watchlist',    subtitle: 'Stocks you\'re watching',   href: '/watchlist',            icon: Eye },
    { label: 'Rebalance',    subtitle: 'AI portfolio rebalancing',  href: '/optimization/rebalance', icon: MessageCircle },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyComponent = new (...args: any[]) => any;
  type NavItem = { label: string; href: string };
  type NavGroup = {
    id: string;
    label: string;
    icon: AnyComponent;
    badge?: 'READ_ONLY' | 'SANDBOX' | 'COMING_SOON' | 'AI' | 'LIVE';
    items: NavItem[];
  };

  const groups: NavGroup[] = [
    {
      id: 'portfolio', label: 'Portfolio', icon: PieChart,
      items: [
        { label: 'Holdings',     href: '/holdings' },
        { label: 'Transactions', href: '/transactions' },
        { label: 'Accounts',     href: '/accounts' },
        { label: 'Watchlist',    href: '/watchlist' },
        { label: 'Snapshots',    href: '/snapshots' },
      ],
    },
    {
      id: 'broker', label: 'Broker', icon: Link2,
      items: [
        { label: 'Connections',  href: '/broker' },
        { label: 'Fund Balance', href: '/fund-balance' },
        { label: 'Import',       href: '/import' },
      ],
    },
    {
      id: 'optimization', label: 'Optimize', icon: Sliders, badge: 'LIVE',
      items: [
        { label: 'Rebalance', href: '/optimization/rebalance' },
      ],
    },
    {
      id: 'trades', label: 'Trades', icon: ClipboardList, badge: 'SANDBOX',
      items: [
        { label: 'Overview', href: '/trades' },
        { label: 'Tickets',  href: '/trades/tickets' },
        { label: 'Orders',   href: '/orders' },
      ],
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

  <!-- Nav: Beginner or Advanced -->
  {#if $beginnerMode && !sidebarCollapsed}
    <nav class="sb-nav custom-scrollbar">
      {#each beginnerNav as item}
        {@const active = activePath === item.href || activePath.startsWith(item.href + '/')}
        <a href={item.href} class="sb-beg-item" class:active>
          <svelte:component this={item.icon} size={15} class="sb-icon" />
          <div class="sb-beg-text">
            <span class="sb-beg-label">{item.label}</span>
            <span class="sb-beg-sub">{item.subtitle}</span>
          </div>
        </a>
      {/each}
    </nav>
  {:else}
    <!-- Accordion groups (Advanced) -->
    <nav class="sb-nav custom-scrollbar">
      {#each groups as group}
        {@const isOpen = openGroups.has(group.id)}
        {@const hasActiveChild = group.items.some(i => activePath === i.href || activePath.startsWith(i.href + '/'))}

        <div class="sb-group">
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
              {:else if group.badge === 'LIVE'}
                <span class="badge-live">LIVE</span>
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

          {#if isOpen && !sidebarCollapsed && group.items.length > 0}
            <div class="sb-sub">
              {#each group.items as item}
                {@const active = activePath === item.href || activePath.startsWith(item.href + '/')}
                <a href={item.href} class="sb-sub-item" class:active>
                  <span class="sb-sub-dot" class:active></span>
                  {item.label}
                </a>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </nav>
  {/if}

  <!-- Bottom: mode toggle + collapse + settings -->
  <div class="sb-bottom">
    {#if !sidebarCollapsed}
      <button class="sb-mode-toggle" class:beginner={$beginnerMode} on:click={() => beginnerMode.toggle()}>
        <div class="sb-mode-info">
          <span class="sb-mode-label">{$beginnerMode ? 'BEGINNER MODE' : 'ADVANCED MODE'}</span>
          <span class="sb-mode-hint">{$beginnerMode ? 'Switch to Advanced →' : '← Switch to Beginner'}</span>
        </div>
        <div class="sb-mode-pill" class:on={$beginnerMode}>
          <div class="sb-mode-dot"></div>
        </div>
      </button>
    {/if}

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
    background: transparent;
    transition: width 0.2s ease;
  }

  .sb-logo { padding: 14px 12px; border-bottom: 1px solid var(--overlay-border); flex-shrink: 0; }
  .sb-logo-full { display: flex; align-items: center; gap: 8px; }
  .sb-mark { font-size: 1.1rem; font-weight: 800; color: var(--primary); }
  .sb-mark-center { display: block; text-align: center; }
  .sb-name { font-size: 0.8rem; font-weight: 700; color: var(--text); }
  .sb-tagline { font-size: 0.6rem; color: var(--muted); }

  .sb-section-wrap { padding: 8px 8px 4px; }

  .sb-divider { height: 1px; background: var(--overlay-border); margin: 4px 0; }

  .sb-nav { flex: 1; overflow-y: auto; padding: 4px 8px; }

  .sb-item {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 8px; border-radius: 6px;
    font-size: 0.8rem; font-weight: 500;
    color: var(--muted); text-decoration: none;
    transition: background 0.15s, color 0.15s;
    width: 100%;
  }
  .sb-item:hover { background: rgba(var(--primary-rgb),0.08); color: var(--text); }
  .sb-item.active { background: rgba(var(--primary-rgb),0.14); color: var(--primary); font-weight: 600; }

  .sb-group { margin-bottom: 2px; }

  .sb-group-header {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 8px; border-radius: 6px;
    font-size: 0.8rem; font-weight: 500;
    color: var(--muted); background: none; border: none;
    cursor: pointer; width: 100%; text-align: left;
    transition: background 0.15s, color 0.15s;
  }
  .sb-group-header:hover { background: rgba(var(--primary-rgb),0.08); color: var(--text); }
  .sb-group-header.active { color: var(--text); }
  .sb-group-header.coming-soon { opacity: 0.5; cursor: default; }

  .sb-group-label { flex: 1; }
  .sb-chevron { display: flex; transition: transform 0.2s; color: var(--muted); }
  .sb-chevron.open { transform: rotate(90deg); }

  .badge-sandbox { font-size: 0.55rem; font-weight: 700; padding: 1px 6px; border-radius: 20px; background: rgba(var(--warning-rgb),0.12); color: var(--warning); }
  .badge-ai { font-size: 0.7rem; color: var(--primary); }
  .badge-live { font-size: 0.55rem; font-weight: 700; padding: 1px 6px; border-radius: 20px; background: rgba(var(--success-rgb),0.12); color: var(--success); }

  .sb-sub { padding: 2px 0 4px 24px; }
  .sb-sub-item {
    display: flex; align-items: center; gap: 8px;
    padding: 5px 8px; border-radius: 6px;
    font-size: 0.77rem; color: var(--muted);
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
  }
  .sb-sub-item:hover { color: var(--text); background: rgba(var(--primary-rgb),0.06); }
  .sb-sub-item.active { color: var(--primary); }

  .sb-sub-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--border); flex-shrink: 0; transition: background 0.15s; }
  .sb-sub-dot.active { background: var(--primary); }

  .sb-bottom {
    flex-shrink: 0; padding: 8px;
    border-top: 1px solid var(--overlay-border);
    display: flex; flex-direction: column; gap: 2px;
  }

  .sb-collapse-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 8px; border-radius: 6px;
    font-size: 0.75rem; color: var(--muted);
    background: none; border: none; cursor: pointer; width: 100%;
    transition: background 0.15s, color 0.15s;
  }
  .sb-collapse-btn:hover { background: rgba(var(--primary-rgb),0.08); color: var(--text); }

  :global(.sb-icon) { flex-shrink: 0; }
  .sb-item-label { flex: 1; }

  /* Beginner nav items */
  .sb-beg-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 8px; border-radius: 8px;
    text-decoration: none; color: var(--muted);
    transition: background 0.15s, color 0.15s;
    margin-bottom: 2px;
  }
  .sb-beg-item:hover { background: rgba(var(--primary-rgb),0.08); color: var(--text); }
  .sb-beg-item.active { background: rgba(var(--primary-rgb),0.14); color: var(--primary); }
  .sb-beg-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .sb-beg-label { font-size: 0.8rem; font-weight: 600; }
  .sb-beg-sub { font-size: 0.62rem; color: var(--muted); opacity: 0.75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sb-beg-item.active .sb-beg-sub { color: rgba(var(--primary-rgb),0.7); opacity: 1; }

  /* Mode toggle */
  .sb-mode-toggle {
    display: flex; align-items: center; justify-content: space-between;
    padding: 7px 10px; border-radius: 8px; width: 100%;
    background: rgba(var(--success-rgb),0.06); border: 1px solid rgba(var(--success-rgb),0.2);
    cursor: pointer; transition: background 0.15s;
    margin-bottom: 4px;
  }
  .sb-mode-toggle:not(.beginner) {
    background: rgba(var(--primary-rgb),0.06); border-color: rgba(var(--primary-rgb),0.2);
  }
  .sb-mode-toggle:hover { filter: brightness(1.1); }
  .sb-mode-info { display: flex; flex-direction: column; gap: 1px; text-align: left; }
  .sb-mode-label { font-size: 0.6rem; font-weight: 700; color: var(--success); letter-spacing: 0.06em; }
  .sb-mode-toggle:not(.beginner) .sb-mode-label { color: var(--primary); }
  .sb-mode-hint { font-size: 0.58rem; color: var(--muted); }
  .sb-mode-pill {
    width: 28px; height: 16px; border-radius: 8px;
    background: var(--border); border: 1px solid var(--border);
    position: relative; flex-shrink: 0; transition: background 0.2s;
  }
  .sb-mode-pill.on { background: var(--success); border-color: var(--success); }
  .sb-mode-dot {
    width: 12px; height: 12px; border-radius: 50%;
    background: var(--muted); position: absolute; top: 1px; left: 2px;
    transition: left 0.2s, background 0.2s;
  }
  .sb-mode-pill.on .sb-mode-dot { left: 14px; background: #fff; }
</style>
