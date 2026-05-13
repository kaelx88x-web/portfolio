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
