<!-- src/lib/components/stocks/StockCard.svelte -->
<script lang="ts">
  import type { Asset } from '@prisma/client';
  import type { StockMeta } from '$lib/data/stock-metadata';
  import MiniSparkline from './MiniSparkline.svelte';
  import InvestmentTag from './InvestmentTag.svelte';
  import WatchlistToggle from './WatchlistToggle.svelte';

  export let asset: Asset;
  export let meta: StockMeta;
  export let owned: { qty: number; avgCost: number } | undefined = undefined;
  export let watchlisted: boolean;
  export let onAdd: () => void;
  export let onWatchlist: ((val: boolean) => void) | undefined = undefined;

  $: price = asset.latestPrice;
  $: ownedGain = owned && price > 0 ? (price - owned.avgCost) * owned.qty : 0;
  $: ownedPct  = owned && owned.avgCost > 0 ? ((price - owned.avgCost) / owned.avgCost) * 100 : 0;
  $: displayTags = meta.tags.slice(0, 2);
</script>

<div class="stock-card">
  <div class="card-top">
    <div class="card-symbol-row">
      <span class="symbol">{asset.symbol}</span>
      <div class="card-actions">
        <WatchlistToggle assetId={asset.id} bind:watchlisted on:toggle={(e) => onWatchlist?.(e.detail)} />
      </div>
    </div>
    <MiniSparkline symbol={asset.symbol} trend={meta.sparkTrend} />
  </div>

  <div class="card-name">{asset.name}</div>
  <div class="card-meta">
    {#if asset.exchange}<span>{asset.exchange}</span>{/if}
    {#if asset.sector}<span>· {asset.sector}</span>{/if}
  </div>

  <div class="card-price-row">
    <span class="price">
      {price > 0 ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
      {#if asset.currency && asset.currency !== 'USD'}<span class="currency">{asset.currency}</span>{/if}
    </span>
    {#if owned && owned.qty > 0}
      <span class="owned-badge" class:gain={ownedGain >= 0} class:loss={ownedGain < 0}>
        {owned.qty.toFixed(owned.qty % 1 === 0 ? 0 : 2)} sh
        {ownedPct >= 0 ? '+' : ''}{ownedPct.toFixed(1)}%
      </span>
    {/if}
  </div>

  <div class="card-stats">
    {#if meta.pe !== null}<span>P/E {meta.pe}</span>{/if}
    {#if meta.marketCap}<span>Mkt {meta.marketCap}</span>{/if}
    {#if meta.dividendYield !== null}<span>Div {meta.dividendYield}%</span>{/if}
  </div>

  {#if displayTags.length > 0}
    <div class="card-tags">
      {#each displayTags as tag}
        <InvestmentTag {tag} />
      {/each}
    </div>
  {/if}

  {#if meta.aiSummary}
    <div class="card-ai-summary">"{meta.aiSummary}"</div>
  {/if}

  <button class="add-btn" on:click={onAdd}>+ Add to Portfolio</button>
</div>

<style>
  .stock-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s;
    position: relative;
  }
  .stock-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    border-color: rgba(108,143,255,0.3);
  }
  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .card-symbol-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .symbol {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text);
    letter-spacing: 0.02em;
  }
  .card-actions { display: flex; align-items: center; }
  .card-name {
    font-size: 0.75rem;
    color: var(--text);
    font-weight: 500;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .card-meta {
    font-size: 0.68rem;
    color: var(--muted);
    display: flex;
    gap: 4px;
  }
  .card-price-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 2px;
  }
  .price {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text);
  }
  .currency { font-size: 0.65rem; color: var(--muted); margin-left: 2px; }
  .owned-badge {
    font-size: 0.65rem;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .owned-badge.gain { background: rgba(45,212,160,0.12); color: var(--success); }
  .owned-badge.loss { background: rgba(249,107,126,0.12); color: var(--danger); }
  .card-stats {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .card-stats span {
    font-size: 0.65rem;
    color: var(--muted);
  }
  .card-tags { display: flex; gap: 4px; flex-wrap: wrap; }
  .card-ai-summary {
    font-size: 0.65rem;
    color: var(--muted);
    font-style: italic;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .add-btn {
    margin-top: 4px;
    width: 100%;
    padding: 8px;
    background: rgba(108,143,255,0.1);
    border: 1px solid rgba(108,143,255,0.25);
    border-radius: 8px;
    color: var(--primary);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .add-btn:hover {
    background: rgba(108,143,255,0.18);
    border-color: var(--primary);
  }
</style>
