<script lang="ts">
  import { money } from '$lib/format';
  import { Pencil, Trash2 } from 'lucide-svelte';

  export let data;
  export let form;
</script>

<div class="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
  <div>
    <h1 class="text-2xl font-bold">Assets</h1>
    <p class="mt-1 text-sm text-slate-500">Manual symbol master data and mock latest prices.</p>
  </div>
  <form method="GET" class="flex gap-2">
    <input name="q" class="field w-56" value={data.search ?? ''} placeholder="Search symbol" />
    <button class="button-secondary">Search</button>
  </form>
</div>

{#if form?.message}
  <div class="mb-4 rounded-md border border-line bg-white px-4 py-3 text-sm">{form.message}</div>
{/if}

<section class="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
  <form method="POST" action="?/create" class="card space-y-4 p-5">
    <h2 class="font-bold">Add asset</h2>
    <div class="grid gap-4 sm:grid-cols-2">
      <div>
        <label class="label" for="symbol">Symbol</label>
        <input id="symbol" name="symbol" class="field mt-1" placeholder="AAPL" required />
      </div>
      <div>
        <label class="label" for="assetType">Type</label>
        <select id="assetType" name="assetType" class="field mt-1">
          <option value="stock">Stock</option>
          <option value="etf">ETF</option>
          <option value="crypto">Crypto</option>
          <option value="cash">Cash</option>
          <option value="bond">Bond</option>
        </select>
      </div>
    </div>
    <div>
      <label class="label" for="name">Name</label>
      <input id="name" name="name" class="field mt-1" placeholder="Apple Inc." required />
    </div>
    <div class="grid gap-4 sm:grid-cols-3">
      <input name="exchange" class="field" placeholder="Exchange" />
      <input name="currency" class="field" value="USD" maxlength="3" />
      <input name="latestPrice" class="field" type="number" step="0.0001" placeholder="Latest price" />
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      <input name="sector" class="field" placeholder="Sector" />
      <input name="country" class="field" placeholder="Country" />
    </div>
    <button class="button">Create asset</button>
  </form>

  <div class="space-y-4">
    {#each data.assets as asset}
      <details class="card p-5">
        <summary class="flex cursor-pointer list-none justify-between gap-4">
          <div>
            <div class="font-bold">{asset.symbol}</div>
            <div class="mt-1 text-sm text-slate-500">{asset.name} - {asset.assetType}</div>
          </div>
          <div class="text-right font-bold">{money(asset.latestPrice, asset.currency)}</div>
        </summary>
        <form method="POST" action="?/update" class="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
          <input type="hidden" name="assetId" value={asset.id} />
          <input name="symbol" class="field" value={asset.symbol} />
          <input name="assetType" class="field" value={asset.assetType} />
          <input name="name" class="field sm:col-span-2" value={asset.name} />
          <input name="exchange" class="field" value={asset.exchange ?? ''} />
          <input name="currency" class="field" value={asset.currency} maxlength="3" />
          <input name="latestPrice" class="field" type="number" step="0.0001" value={asset.latestPrice} />
          <input name="sector" class="field" value={asset.sector ?? ''} />
          <input name="country" class="field" value={asset.country ?? ''} />
          <div class="flex gap-2 sm:col-span-2">
            <button class="button-secondary"><Pencil size={16} /> Update</button>
          </div>
        </form>
        <form method="POST" action="?/delete" class="mt-3">
          <input type="hidden" name="assetId" value={asset.id} />
          <button class="button-secondary text-danger"><Trash2 size={16} /> Delete</button>
        </form>
      </details>
    {/each}
  </div>
</section>
