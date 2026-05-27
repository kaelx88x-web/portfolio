<script lang="ts">
  import { page } from '$app/stores';
  import { navigating } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
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
    window.addEventListener('keydown', handleWindowKeydown);
  });

  onDestroy(() => {
    if (browser) window.removeEventListener('keydown', handleWindowKeydown);
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

  // Window-level Escape handler: closes fly-out even when focus is not inside it
  function handleWindowKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && showFlyout) {
      closeFlyout();
    }
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
    if (!section?.children?.length) return;
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
      sidebarCollapsed={$pinnedSection === null}
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
    min-height: 56px; flex-shrink: 0;
    border-bottom: 1px solid var(--overlay-border);
    background: var(--bg-glass);
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    z-index: 50;
    box-shadow: 0 1px 0 rgba(var(--primary-rgb),0.06), 0 4px 24px rgba(0,0,0,0.2);
  }

  .shell-body {
    display: flex; flex: 1; overflow: hidden; position: relative;
  }

  /* Icon rail — always 48px */
  .shell-sidebar {
    width: 48px; flex-shrink: 0;
    border-right: 1px solid var(--overlay-border);
    background: var(--sidebar-glass);
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    box-shadow: 1px 0 0 rgba(var(--primary-rgb),0.05);
    z-index: 30;
    overflow: visible;
  }

  /* Fly-out wrapper */
  .flyout-wrapper {
    position: absolute;
    left: 48px;
    top: 0;
    bottom: 0;
    width: 200px;
    z-index: 40;
  }
  .flyout-wrapper.pinned {
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

  /* Mobile */
  @media (max-width: 768px) {
    .shell-sidebar  { display: none; }
    .flyout-wrapper { display: none; }
    .shell-main     { padding: 16px; padding-bottom: 72px; }
    .shell-ai-panel { width: 100%; max-width: 320px; }
  }

  /* Tablet */
  @media (min-width: 769px) and (max-width: 1024px) {
    .shell-main { padding: 20px; }
  }
</style>
