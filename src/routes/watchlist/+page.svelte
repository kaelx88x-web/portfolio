<script lang="ts">
  import { money } from '$lib/format';
  import { Plus, Trash2 } from 'lucide-svelte';

  export let data;
  export let form;
</script>

<div class="mb-6">
  <h1 class="text-2xl font-bold">Watchlist</h1>
  <p class="mt-1 text-sm text-slate-500">Save symbols and notes before they become holdings.</p>
</div>

{#if form?.message}
  <div class="mb-4 rounded-md border border-line bg-white px-4 py-3 text-sm">{form.message}</div>
{/if}

<section class="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
  <div class="space-y-6">
    <form method="POST" action="?/createList" class="card space-y-4 p-5">
      <h2 class="font-bold">Create watchlist</h2>
      <input name="name" class="field" placeholder="Growth ideas" required />
      <button class="button"><Plus size={16} /> Create list</button>
    </form>

    <form method="POST" action="?/addItem" class="card space-y-4 p-5">
      <h2 class="font-bold">Add symbol</h2>
      <select name="watchlistId" class="field" required>
        {#each data.watchlists as watchlist}
          <option value={watchlist.id}>{watchlist.name}</option>
        {/each}
      </select>
      <select name="assetId" class="field">
        <option value="">Choose existing asset</option>
        {#each data.assets as asset}
          <option value={asset.id}>{asset.symbol} - {asset.name}</option>
        {/each}
      </select>
      <input name="symbol" class="field" placeholder="Or type new symbol" />
      <input name="notes" class="field" placeholder="Notes" />
      <button class="button">Save item</button>
    </form>
  </div>

  <div class="space-y-4">
    {#each data.watchlists as watchlist}
      <div class="card p-5">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="font-bold">{watchlist.name}</h2>
            <p class="text-sm text-slate-500">{watchlist.items.length} symbols</p>
          </div>
          <form method="POST" action="?/deleteList">
            <input type="hidden" name="watchlistId" value={watchlist.id} />
            <button class="icon-button text-danger" title="Delete watchlist"><Trash2 size={16} /></button>
          </form>
        </div>
        <div class="space-y-3">
          {#each watchlist.items as item}
            <div class="flex items-center justify-between gap-4 rounded-md border border-line p-3">
              <div>
                <div class="font-semibold">{item.asset.symbol}</div>
                <div class="text-sm text-slate-500">{item.asset.name}</div>
                {#if item.notes}
                  <div class="mt-1 text-xs text-slate-500">{item.notes}</div>
                {/if}
              </div>
              <div class="flex items-center gap-3">
                <div class="text-right text-sm font-semibold">{money(item.asset.latestPrice, item.asset.currency)}</div>
                <form method="POST" action="?/removeItem">
                  <input type="hidden" name="itemId" value={item.id} />
                  <button class="icon-button text-danger" title="Remove symbol"><Trash2 size={16} /></button>
                </form>
              </div>
            </div>
          {/each}
          {#if watchlist.items.length === 0}
            <p class="text-sm text-slate-500">No symbols yet.</p>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</section>
