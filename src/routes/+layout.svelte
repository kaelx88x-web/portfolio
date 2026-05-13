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
