<script lang="ts">
  import { onMount } from 'svelte';
  import { page, navigating } from '$app/stores';
  import Sidebar from './Sidebar.svelte';
  import Topbar  from './Topbar.svelte';

  export let showAiPanel = false;

  let sidebarCollapsed = false;
  let mobileMenuOpen   = false;
  let aiPanelOpen      = showAiPanel;

  const AI_PANEL_ROUTES = ['/dashboard', '/ai'];

  onMount(() => {
    const sc = localStorage.getItem('portfolioai:sidebar-collapsed');
    if (sc !== null) sidebarCollapsed = sc === 'true';

    const stored = localStorage.getItem('portfolioai:ai-panel-open');
    if (stored !== null) {
      aiPanelOpen = stored === 'true';
    } else {
      const path = $page.url.pathname;
      aiPanelOpen = AI_PANEL_ROUTES.some(r => path === r || path.startsWith(r + '/'));
    }
  });

  // Close mobile menu on route change
  $: if ($page.url.pathname) mobileMenuOpen = false;

  function toggleSidebar() {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      mobileMenuOpen = !mobileMenuOpen;
    } else {
      sidebarCollapsed = !sidebarCollapsed;
      localStorage.setItem('portfolioai:sidebar-collapsed', String(sidebarCollapsed));
    }
  }

  function closeMobileMenu() { mobileMenuOpen = false; }

  function toggleAiPanel() {
    aiPanelOpen = !aiPanelOpen;
    localStorage.setItem('portfolioai:ai-panel-open', String(aiPanelOpen));
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
      {sidebarCollapsed}
      {aiPanelOpen}
      on:toggleSidebar={toggleSidebar}
      on:toggleAiPanel={toggleAiPanel}
    />
  </header>

  <div class="shell-body">

    <!-- Mobile sidebar backdrop -->
    {#if mobileMenuOpen}
      <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
      <div class="mobile-backdrop" on:click={closeMobileMenu}></div>
    {/if}

    <!-- Sidebar -->
    <aside
      class="shell-sidebar"
      class:collapsed={sidebarCollapsed}
      class:mobile-open={mobileMenuOpen}
    >
      <Sidebar {sidebarCollapsed} on:toggleSidebar={toggleSidebar} />
    </aside>

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
    z-index: 40;
    box-shadow: 0 1px 0 rgba(var(--primary-rgb),0.06), 0 4px 24px rgba(0,0,0,0.2);
  }

  .shell-body {
    display: flex; flex: 1; overflow: hidden; position: relative;
  }

  /* ── Desktop sidebar ── */
  .shell-sidebar {
    width: 240px; flex-shrink: 0;
    transition: width 0.2s ease;
    border-right: 1px solid var(--overlay-border);
    background: var(--sidebar-glass);
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    overflow: hidden;
    box-shadow: 1px 0 0 rgba(var(--primary-rgb),0.05);
  }
  .shell-sidebar.collapsed { width: 48px; }

  .shell-main {
    flex: 1; overflow-y: auto;
    padding: 24px 28px;
    min-width: 0;
  }

  /* ── AI panel ── */
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

  /* ── Mobile ── */
  @media (max-width: 767px) {
    /* Sidebar becomes a fixed off-canvas drawer */
    .shell-sidebar {
      position: fixed;
      top: 56px; left: 0; bottom: 0;
      width: 260px !important;          /* override collapsed width */
      transform: translateX(-100%);
      transition: transform 0.25s ease;
      z-index: 45;
      border-right: 1px solid var(--overlay-border);
    }
    .shell-sidebar.mobile-open {
      transform: translateX(0);
      box-shadow: 4px 0 24px rgba(0,0,0,0.35);
    }

    /* Backdrop for mobile drawer */
    .mobile-backdrop {
      position: fixed; inset: 56px 0 0 0;
      background: rgba(0,0,0,0.45);
      z-index: 44;
      backdrop-filter: blur(2px);
    }

    /* Main takes full width */
    .shell-main {
      padding: 16px;
    }

    /* AI panel narrower on mobile */
    .shell-ai-panel {
      width: 100%;
      max-width: 320px;
    }
  }
</style>
