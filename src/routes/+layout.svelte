<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import '../app.css';
  import AppShell from '$lib/components/portfolioai/AppShell.svelte';
  import { portfolioSummary } from '$lib/stores/portfolio-summary';
  import { theme } from '$lib/stores/ui';
  import type { LayoutData } from './$types';

  export let data: LayoutData;

  const publicRoutes = new Set(['/', '/login', '/register']);
  $: isPublicRoute = publicRoutes.has($page.url.pathname);

  const aiPanelRoutes = ['/dashboard', '/ai'];
  $: showAiPanel = aiPanelRoutes.some(r => $page.url.pathname === r || $page.url.pathname.startsWith(r + '/'));

  // Seed the store from layout data so every page has a value, not just /dashboard.
  // The dashboard page will overwrite this with more precise data (including day P&L %).
  $: if (data?.portfolioSummary && $portfolioSummary.totalValue === 0) {
    portfolioSummary.set({
      totalValue:   data.portfolioSummary.totalValue,
      dayChange:    data.portfolioSummary.dayPl,
      dayChangePct: data.portfolioSummary.dayChangePct,
      accountName:  data.portfolioSummary.accountName,
      accountMode:  'LIVE',
    });
  }

  onMount(() => theme.init());
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
