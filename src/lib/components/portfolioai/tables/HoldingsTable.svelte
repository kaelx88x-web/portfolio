<script lang="ts">
  import type { Holding } from '$lib/types/portfolio';
  import LoadingSkeleton from '../LoadingSkeleton.svelte';
  import EmptyState from '../EmptyState.svelte';

  export let holdings: Holding[] = [];
  export let loading = false;
  export let flowMap: Record<string, { in_flow: number | null; big_in_flow: number | null; sml_in_flow: number | null; error: string | null }> = {};

  let search = '';
  type NumericHoldingKey = 'quantity' | 'averageCost' | 'marketValue' | 'unrealizedPnl' | 'allocationPercentage';
  let sortKey: NumericHoldingKey = 'marketValue';
  let sortAsc = false;

  function flowLabel(code: string): { label: string; cls: string; title: string } {
    const f = flowMap[code];
    if (!f || f.error || f.in_flow === null) return { label: '—', cls: 'flow-nil', title: 'No flow data' };
    const v = f.in_flow;
    if (Math.abs(v) < 1000) return { label: '—', cls: 'flow-nil', title: 'Flow data unavailable (market closed)' };
    const abs = Math.abs(v);
    const fmt = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(1)}M` : abs >= 1_000 ? `$${(abs / 1_000).toFixed(0)}K` : `$${abs.toFixed(0)}`;
    const dir = v >= 0 ? '↑' : '↓';
    const cls = v >= 0 ? 'flow-in' : 'flow-out';
    const big = f.big_in_flow ?? 0;
    const sml = f.sml_in_flow ?? 0;
    const title = `Net: ${v >= 0 ? '+' : '-'}${fmt}  |  Big: ${big >= 0 ? '+' : ''}${(big / 1_000).toFixed(0)}K  |  Retail: ${sml >= 0 ? '+' : ''}${(sml / 1_000).toFixed(0)}K`;
    return { label: `${dir} ${fmt}`, cls, title };
  }

  $: filtered = holdings
    .filter(h =>
      !search ||
      h.symbol.toLowerCase().includes(search.toLowerCase()) ||
      h.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortAsc ? av - bv : bv - av;
    });

  function sort(key: NumericHoldingKey) {
    if (sortKey === key) sortAsc = !sortAsc;
    else { sortKey = key; sortAsc = false; }
  }

  function money(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }
</script>

<div class="ht-bar">
  <input class="field ht-search" placeholder="Search symbol or name…" bind:value={search} />
  <a href="/holdings/export" class="button-secondary" style="font-size:0.75rem;height:36px;padding:0 12px">Export CSV</a>
</div>

<div class="table-wrap">
  {#if loading}
    <div style="padding:16px"><LoadingSkeleton variant="table" rows={8} /></div>
  {:else if filtered.length === 0}
    <EmptyState
      icon="◎"
      title="No holdings found"
      description="Import transactions or sync a broker to see positions here."
      ctaLabel="Import CSV"
      ctaHref="/import"
    />
  {:else}
    <table class="data-table">
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Name</th>
          <th class="th-r" on:click={() => sort('quantity')} style="cursor:pointer">Qty</th>
          <th class="th-r" on:click={() => sort('averageCost')} style="cursor:pointer">Avg Cost</th>
          <th class="th-r" on:click={() => sort('marketValue')} style="cursor:pointer">Mkt Value</th>
          <th class="th-r" on:click={() => sort('unrealizedPnl')} style="cursor:pointer">Unr. P&amp;L</th>
          <th class="th-r" on:click={() => sort('allocationPercentage')} style="cursor:pointer">Alloc %</th>
          <th class="th-r">Flow</th>
          <th>Account</th>
        </tr>
      </thead>
      <tbody>
        {#each filtered as h}
          <tr>
            <td class="td-symbol">
              <a href="/holdings/{encodeURIComponent(h.symbol)}" class="sym-link">{h.symbol}</a>
            </td>
            <td class="td-muted">{h.name}</td>
            <td class="td-r">{h.quantity.toFixed(4)}</td>
            <td class="td-r">{money(h.averageCost)}</td>
            <td class="td-r">{money(h.marketValue)}</td>
            <td class="td-r" class:positive={h.unrealizedPnl >= 0} class:negative={h.unrealizedPnl < 0}>
              {money(h.unrealizedPnl)}
            </td>
            <td class="td-r">{h.allocationPercentage.toFixed(1)}%</td>
            <td class="td-r td-sm">
              {#if Object.keys(flowMap).length > 0}
                {@const fl = flowLabel(h.symbol)}
                <span class="flow-badge {fl.cls}" title={fl.title}>{fl.label}</span>
              {:else}
                <span class="flow-nil">—</span>
              {/if}
            </td>
            <td class="td-muted td-sm">{h.accountName}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .ht-bar    { display:flex; gap:8px; align-items:center; margin-bottom:12px; }
  .ht-search { max-width:280px; height:36px; }
  .th-r      { text-align:right; }
  .td-r      { text-align:right; }
  .td-symbol { font-weight:700; }
  .sym-link  { color:var(--primary); text-decoration:none; }
  .sym-link:hover { text-decoration:underline; }
  .td-muted  { color:var(--muted); }
  .td-sm     { font-size:0.72rem; }
  .positive  { color:var(--success); }
  .negative  { color:var(--danger); }

  .flow-badge {
    display: inline-block;
    font-size: 0.68rem; font-weight: 600;
    padding: 2px 6px; border-radius: 4px;
    white-space: nowrap;
  }
  .flow-in  { background: rgba(var(--success-rgb), 0.12); color: var(--success); }
  .flow-out { background: rgba(var(--danger-rgb),  0.12); color: var(--danger); }
  .flow-nil { color: var(--muted); font-size: 0.75rem; }
</style>
