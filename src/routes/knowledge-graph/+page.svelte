<script lang="ts">
  import KnowledgeGraphChart from '$lib/components/portfolioai/charts/KnowledgeGraphChart.svelte';
  import { invalidateAll } from '$app/navigation';

  export let data: {
    nodes: { ticker: string; name: string; sector: string | null; market: string | null }[];
    edges: { source: string; target: string; type: string; weight: number; confidence: number | null; groundedSource: string | null }[];
    hasPositions: boolean;
  };

  let refreshing = false;
  let message = '';

  async function refresh() {
    refreshing = true;
    message = 'Building graph…';
    try {
      const res = await fetch('/api/knowledge-graph/refresh', { method: 'POST' });
      const body = await res.json();
      message = body.message ?? body.error ?? 'Done.';
      await invalidateAll();
    } catch {
      message = 'Refresh failed.';
    } finally {
      refreshing = false;
    }
  }
</script>

<div class="kg-page">
  <header class="kg-header">
    <div>
      <h1>Knowledge Graph</h1>
      <p class="kg-sub">Relationships between your holdings — structural facts (dashed) and AI-classified links (solid).</p>
    </div>
    <button class="kg-refresh" on:click={refresh} disabled={refreshing}>
      {refreshing ? 'Building…' : 'Rebuild graph'}
    </button>
  </header>

  {#if message}<div class="kg-msg">{message}</div>{/if}

  {#if data.nodes.length}
    <KnowledgeGraphChart nodes={data.nodes} edges={data.edges} />
  {:else}
    <div class="kg-empty">
      {data.hasPositions
        ? 'No graph yet. Click "Rebuild graph" to map your positions.'
        : 'No positions found. Sync your broker first.'}
    </div>
  {/if}

  <p class="kg-disclaimer">Untuk tujuan pendidikan sahaja — bukan nasihat kewangan</p>
</div>

<style>
  .kg-page { padding: 20px; }
  .kg-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
  .kg-header h1 { font-size: 1.1rem; font-weight: 700; color: var(--text); margin: 0; }
  .kg-sub { font-size: 0.78rem; color: var(--muted); margin: 4px 0 0; max-width: 60ch; }
  .kg-refresh {
    padding: 8px 14px; border-radius: 6px; font-size: 0.78rem; font-weight: 600;
    color: var(--primary); background: rgba(var(--primary-rgb), 0.15);
    border: 1px solid rgba(var(--primary-rgb), 0.3); cursor: pointer;
  }
  .kg-refresh:disabled { opacity: 0.6; cursor: default; }
  .kg-msg { font-size: 0.75rem; color: var(--muted); margin-bottom: 10px; }
  .kg-empty {
    height: 320px; display: grid; place-items: center; color: var(--muted);
    background: var(--card); border: 1px solid var(--border); border-radius: 10px; font-size: 0.85rem;
  }
  .kg-disclaimer { margin-top: 14px; font-size: 0.7rem; color: var(--muted); font-style: italic; }
</style>
