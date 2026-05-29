<!-- src/lib/components/stocks/AddDrawer.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import type { Asset } from '@prisma/client';
  import { getStockMeta } from '$lib/data/stock-metadata';

  export let open = false;
  export let selectedAsset: Asset | null = null;

  let activeTab: 'shares' | 'options' = 'shares';
  let txType: 'BUY' | 'SELL' = 'BUY';
  let quantity = '';
  let price = '';
  let tradeDate = new Date().toISOString().slice(0, 10);
  let fee = '';
  let submitting = false;
  let successMsg = '';
  let errorMsg = '';

  $: if (selectedAsset) {
    price = selectedAsset.latestPrice > 0 ? selectedAsset.latestPrice.toFixed(2) : '';
    activeTab = 'shares';
    txType = 'BUY';
    quantity = '';
    fee = '';
    successMsg = '';
    errorMsg = '';
  }

  $: meta = selectedAsset ? getStockMeta(selectedAsset.symbol, selectedAsset.sector) : null;

  function close() {
    open = false;
    selectedAsset = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (open && selectedAsset && e.key === 'Escape') close();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open && selectedAsset}
  <!-- Backdrop -->
  <div class="backdrop" on:click={close} aria-hidden="true"></div>

  <!-- Drawer panel -->
  <div class="drawer" class:open role="dialog" aria-modal="true" aria-label="Add {selectedAsset.symbol} to portfolio">
    <!-- Header -->
    <div class="drawer-header">
      <div class="asset-info">
        <span class="asset-symbol">{selectedAsset.symbol}</span>
        <span class="asset-name">{selectedAsset.name}</span>
        {#if selectedAsset.exchange}<span class="asset-exchange">{selectedAsset.exchange}</span>{/if}
        {#if selectedAsset.latestPrice > 0}
          <span class="asset-price">${selectedAsset.latestPrice.toFixed(2)}</span>
        {/if}
      </div>
      <button class="close-btn" on:click={close} aria-label="Close">✕</button>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab" class:active={activeTab === 'shares'} on:click={() => activeTab = 'shares'}>
        📈 Buy Shares
      </button>
      <button class="tab" class:active={activeTab === 'options'} on:click={() => activeTab = 'options'}>
        ⚙ Trade Options
      </button>
    </div>

    <!-- Buy Shares tab -->
    {#if activeTab === 'shares'}
      <div class="drawer-body">
        {#if successMsg}
          <div class="success-msg">✓ {successMsg}</div>
        {/if}
        {#if errorMsg}
          <div class="error-msg">⚠ {errorMsg}</div>
        {/if}

        <form
          method="POST"
          action="?/add"
          use:enhance={() => {
            submitting = true;
            errorMsg = '';
            return async ({ result, update }) => {
              submitting = false;
              if (result.type === 'success' && result.data?.added) {
                successMsg = `Added ${selectedAsset?.symbol}!`;
                quantity = '';
                setTimeout(() => successMsg = '', 2000);
              } else if (result.type === 'failure') {
                errorMsg = (result.data?.error as string) ?? 'Failed to add transaction';
              }
              await update({ reset: false });
            };
          }}
        >
          <input type="hidden" name="assetId" value={selectedAsset.id} />
          <input type="hidden" name="symbol"  value={selectedAsset.symbol} />

          <!-- Type toggle -->
          <div class="field-group">
            <label class="field-label">Type</label>
            <div class="type-toggle">
              <button type="button" class="type-btn" class:active={txType === 'BUY'} on:click={() => txType = 'BUY'}>BUY</button>
              <button type="button" class="type-btn sell" class:active={txType === 'SELL'} on:click={() => txType = 'SELL'}>SELL</button>
            </div>
            <input type="hidden" name="type" value={txType} />
          </div>

          <div class="field-group">
            <label class="field-label" for="qty">Quantity</label>
            <input id="qty" class="field-input" name="quantity" type="number" step="0.000001" min="0.000001"
              placeholder="e.g. 10" bind:value={quantity} required />
          </div>

          <div class="field-group">
            <label class="field-label" for="px">Price per share</label>
            <input id="px" class="field-input" name="price" type="number" step="0.0001" min="0.0001"
              placeholder="e.g. 189.30" bind:value={price} required />
          </div>

          <div class="field-group">
            <label class="field-label" for="dt">Trade date</label>
            <input id="dt" class="field-input" name="tradeDate" type="date" bind:value={tradeDate} required />
          </div>

          <div class="field-group">
            <label class="field-label" for="fee">Fee <span class="optional">(optional)</span></label>
            <input id="fee" class="field-input" name="fee" type="number" step="0.01" min="0"
              placeholder="0.00" bind:value={fee} />
          </div>

          <button class="submit-btn" type="submit" disabled={submitting || !quantity || !price}>
            {submitting ? 'Adding…' : `Add ${txType} Transaction`}
          </button>
        </form>
      </div>
    {/if}

    <!-- Trade Options tab -->
    {#if activeTab === 'options'}
      <div class="drawer-body">
        <p class="options-desc">Open the Wheel Strategy tool with <strong>{selectedAsset.symbol}</strong> pre-selected.</p>

        <a
          href="/optimization/options/wheel?symbol={selectedAsset.symbol}"
          class="wheel-btn"
          on:click={close}
        >
          Open Wheel Strategy →
        </a>

        <div class="wheel-readiness">
          <div class="readiness-title">Wheel Readiness</div>
          {#if meta?.wheelFriendly}
            <div class="readiness-row good">✅ Wheel Friendly</div>
            <div class="readiness-row good">Weekly options available</div>
            <div class="readiness-row good">High liquidity</div>
          {:else}
            <div class="readiness-row warn">⚠ Low option liquidity</div>
            <div class="readiness-row muted">May have wide bid-ask spreads</div>
          {/if}
          <div class="readiness-future">Live IV data — Phase 2</div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 40;
    animation: fadeIn 0.2s ease;
  }
  .drawer {
    position: fixed;
    top: 0; right: 0; bottom: 0;
    width: 380px;
    background: var(--card);
    border-left: 1px solid var(--border);
    z-index: 50;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
    overflow-y: auto;
  }
  .drawer.open { transform: translateX(0); }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .drawer-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--border);
    gap: 12px;
  }
  .asset-info { display: flex; flex-direction: column; gap: 2px; }
  .asset-symbol { font-size: 1rem; font-weight: 700; color: var(--text); }
  .asset-name   { font-size: 0.75rem; color: var(--muted); }
  .asset-exchange { font-size: 0.68rem; color: var(--muted); }
  .asset-price  { font-size: 0.8rem; font-weight: 600; color: var(--success); }
  .close-btn {
    background: none; border: none; cursor: pointer;
    color: var(--muted); font-size: 0.9rem; padding: 2px 6px;
    border-radius: 4px; flex-shrink: 0;
    transition: color 0.1s;
  }
  .close-btn:hover { color: var(--text); }

  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
  }
  .tab {
    flex: 1;
    padding: 10px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .tab.active { color: var(--primary); border-bottom-color: var(--primary); }

  .drawer-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; flex: 1; }

  .field-group { display: flex; flex-direction: column; gap: 4px; }
  .field-label { font-size: 0.68rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .optional { font-weight: 400; text-transform: none; }
  .field-input {
    background: var(--bg, #080d18);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
    color: var(--text);
    font-size: 0.82rem;
    width: 100%;
    transition: border-color 0.15s;
  }
  .field-input:focus { outline: none; border-color: var(--primary); }

  .type-toggle { display: flex; gap: 0; border-radius: 6px; overflow: hidden; border: 1px solid var(--border); width: fit-content; }
  .type-btn {
    padding: 6px 16px;
    background: none;
    border: none;
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  .type-btn.active { background: rgba(108,143,255,0.15); color: var(--primary); }
  .type-btn.sell.active { background: rgba(249,107,126,0.15); color: var(--danger); }

  .submit-btn {
    padding: 10px;
    background: var(--primary);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    margin-top: auto;
    transition: opacity 0.15s;
  }
  .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .success-msg {
    background: rgba(45,212,160,0.1);
    border: 1px solid rgba(45,212,160,0.3);
    border-radius: 6px;
    color: var(--success);
    font-size: 0.78rem;
    font-weight: 600;
    padding: 8px 12px;
    animation: fadeIn 0.15s ease;
  }
  .error-msg {
    background: rgba(249,107,126,0.1);
    border: 1px solid rgba(249,107,126,0.3);
    border-radius: 6px;
    color: var(--danger);
    font-size: 0.78rem;
    padding: 8px 12px;
  }

  .options-desc { font-size: 0.78rem; color: var(--muted); line-height: 1.5; }
  .wheel-btn {
    display: block;
    padding: 10px;
    background: rgba(108,143,255,0.1);
    border: 1px solid rgba(108,143,255,0.3);
    border-radius: 8px;
    color: var(--primary);
    font-size: 0.82rem;
    font-weight: 700;
    text-align: center;
    text-decoration: none;
    transition: background 0.15s;
  }
  .wheel-btn:hover { background: rgba(108,143,255,0.18); }

  .wheel-readiness {
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .readiness-title { font-size: 0.72rem; font-weight: 700; color: var(--text); margin-bottom: 2px; }
  .readiness-row { font-size: 0.72rem; }
  .readiness-row.good  { color: var(--success); }
  .readiness-row.warn  { color: var(--warning); }
  .readiness-row.muted { color: var(--muted); }
  .readiness-future {
    font-size: 0.65rem;
    color: var(--muted);
    font-style: italic;
    border-top: 1px solid var(--border);
    padding-top: 6px;
    margin-top: 2px;
  }

  @media (max-width: 767px) {
    .drawer { width: 100%; left: 0; border-left: none; border-top: 1px solid var(--border); }
    .submit-btn { position: sticky; bottom: 0; }
  }
</style>
