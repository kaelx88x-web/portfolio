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
      // Direct-link: <a> tag handles navigation, just clear pin
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
    left: -6px;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 20px;
    background: var(--primary);
    border-radius: 0 2px 2px 0;
  }
</style>
