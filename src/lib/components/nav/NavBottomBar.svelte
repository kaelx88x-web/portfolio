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
