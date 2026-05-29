<script lang="ts">
  import type { Asset } from '@prisma/client';

  export let assets: Asset[];

  interface TrendingCategory {
    id: string; emoji: string; label: string; symbols: string[];
  }

  const CATEGORIES: TrendingCategory[] = [
    { id: 'trending',  emoji: '🔥', label: 'Trending',      symbols: ['NVDA','TSLA','META','AAPL','MSFT'] },
    { id: 'dividend',  emoji: '💰', label: 'High Dividend',  symbols: ['JEPI','SCHD','1155.KL','1295.KL','VOO'] },
    { id: 'volume',    emoji: '⚡', label: 'High Volume',    symbols: ['SPY','QQQ','AMZN','0700.HK','AAPL'] },
    { id: 'ai',        emoji: '🚀', label: 'AI Stocks',      symbols: ['NVDA','MSFT','GOOGL','META','CRM'] },
    { id: 'defensive', emoji: '🛡', label: 'Defensive',      symbols: ['JNJ','KO','PG','WMT','ABBV'] },
    { id: 'mostAdded', emoji: '📈', label: 'Most Added',     symbols: ['VOO','AAPL','VTI','QQQ','MSFT'] },
    { id: 'aiPicks',   emoji: '🧠', label: 'AI Picks',       symbols: ['NVDA','AVGO','CRM','MSFT','GOOGL'] },
  ];

  let activeId: string | null = null;

  $: assetMap = new Map(assets.map(a => [a.symbol, a]));

  function getCategoryAssets(symbols: string[]): Asset[] {
    return symbols.flatMap(s => assetMap.get(s) ? [assetMap.get(s)!] : []);
  }

  function toggle(id: string) {
    activeId = activeId === id ? null : id;
  }

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ add: Asset }>();
</script>

<div class="trending-wrapper">
  <div class="strip" role="list">
    {#each CATEGORIES as cat}
      <button
        class="pill"
        class:active={activeId === cat.id}
        on:click={() => toggle(cat.id)}
        role="listitem"
      >
        <span class="emoji">{cat.emoji}</span>
        <span class="pill-label">{cat.label}</span>
      </button>
    {/each}
  </div>

  {#if activeId}
    {@const active = CATEGORIES.find(c => c.id === activeId)!}
    {@const items = getCategoryAssets(active.symbols)}
    <div class="expanded-panel">
      {#if items.length === 0}
        <span class="empty">Seed the database first — run <code>npx tsx prisma/seed-stocks.ts</code></span>
      {:else}
        {#each items as asset}
          <div class="mini-row">
            <div class="mini-info">
              <span class="mini-symbol">{asset.symbol}</span>
              <span class="mini-name">{asset.name}</span>
            </div>
            <div class="mini-right">
              {#if asset.latestPrice > 0}
                <span class="mini-price">{asset.latestPrice.toFixed(2)}</span>
              {:else}
                <span class="mini-price muted">—</span>
              {/if}
              <button class="mini-add" on:click={() => dispatch('add', asset)}>+ Add</button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .trending-wrapper { margin-bottom: 20px; }
  .strip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: none;
    scroll-snap-type: x mandatory;
  }
  .strip::-webkit-scrollbar { display: none; }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    min-height: 34px;
    scroll-snap-align: start;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }
  .pill:hover, .pill.active {
    border-color: var(--primary);
    background: rgba(108,143,255,0.1);
    color: var(--primary);
  }
  .emoji { font-size: 0.85rem; }
  .expanded-panel {
    margin-top: 8px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  .mini-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    border-bottom: 1px solid var(--border);
    transition: background 0.1s;
  }
  .mini-row:last-child { border-bottom: none; }
  .mini-row:hover { background: rgba(255,255,255,0.02); }
  .mini-info { display: flex; align-items: center; gap: 10px; }
  .mini-symbol { font-size: 0.78rem; font-weight: 700; color: var(--text); min-width: 72px; }
  .mini-name   { font-size: 0.72rem; color: var(--muted); }
  .mini-right  { display: flex; align-items: center; gap: 10px; }
  .mini-price  { font-size: 0.78rem; font-weight: 600; color: var(--text); min-width: 50px; text-align: right; }
  .mini-price.muted { color: var(--muted); }
  .mini-add {
    font-size: 0.68rem;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 6px;
    border: 1px solid rgba(108,143,255,0.3);
    background: rgba(108,143,255,0.08);
    color: var(--primary);
    cursor: pointer;
    transition: background 0.12s;
  }
  .mini-add:hover { background: rgba(108,143,255,0.18); }
  .empty { display: block; padding: 12px 14px; font-size: 0.72rem; color: var(--muted); }
</style>
