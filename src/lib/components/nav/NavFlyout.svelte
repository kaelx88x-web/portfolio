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

<nav
  class="flyout"
  class:flyout-pinned={isPinned}
  aria-label="{section.label} navigation"
  use:clickOutside={{ exclude: railEl }}
  on:outclick={handleOutclick}
  on:mouseenter={onMouseEnter}
  on:mouseleave={onMouseLeave}
  on:keydown={onKeydown}
  in:fly={!isPinned ? { x: -8, duration: 150, easing: cubicOut } : { duration: 0 }}
  out:fly={!isPinned ? { x: -8, duration: 150, easing: cubicOut } : { duration: 0 }}
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
