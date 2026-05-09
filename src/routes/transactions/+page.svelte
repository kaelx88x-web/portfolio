<script lang="ts">
  import { date, money, number } from '$lib/format';
  import { Pencil, Trash2 } from 'lucide-svelte';

  export let data;
  export let form;

  const transactionTypes = ['buy', 'sell', 'dividend', 'fee', 'deposit', 'withdrawal', 'split'];
  const today = new Date().toISOString().slice(0, 10);

  function inputDate(value: string | Date) {
    return new Date(value).toISOString().slice(0, 10);
  }
</script>

<div class="mb-6">
  <h1 class="text-2xl font-bold">Transactions</h1>
  <p class="mt-1 text-sm text-slate-500">Create, edit, delete, and filter manual transactions.</p>
</div>

{#if form?.message}
  <div class="mb-4 rounded-md border border-line bg-white px-4 py-3 text-sm">{form.message}</div>
{/if}

<section class="mb-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
  <form method="POST" action="?/create" class="card space-y-4 p-5">
    <h2 class="font-bold">Add transaction</h2>
    <div class="grid gap-4 sm:grid-cols-2">
      <div>
        <label class="label" for="accountId">Account</label>
        <select id="accountId" name="accountId" class="field mt-1" required>
          {#each data.accounts as account}
            <option value={account.id}>{account.name}</option>
          {/each}
        </select>
      </div>
      <div>
        <label class="label" for="type">Type</label>
        <select id="type" name="type" class="field mt-1">
          {#each transactionTypes as type}
            <option value={type}>{type}</option>
          {/each}
        </select>
      </div>
    </div>
    <div>
      <label class="label" for="assetId">Asset</label>
      <select id="assetId" name="assetId" class="field mt-1">
        <option value="">Cash / no asset</option>
        {#each data.assets as asset}
          <option value={asset.id}>{asset.symbol} - {asset.name}</option>
        {/each}
      </select>
    </div>
    <div class="grid gap-4 sm:grid-cols-4">
      <input name="tradeDate" class="field" type="date" value={today} required />
      <input name="quantity" class="field" type="number" step="0.000001" placeholder="Quantity" />
      <input name="price" class="field" type="number" step="0.0001" placeholder="Price / amount" />
      <input name="fee" class="field" type="number" step="0.0001" value="0" />
    </div>
    <div class="grid gap-4 sm:grid-cols-[0.3fr_0.7fr]">
      <input name="currency" class="field" value="USD" maxlength="3" />
      <input name="notes" class="field" placeholder="Notes" />
    </div>
    <button class="button">Create transaction</button>
  </form>

  <form method="GET" class="card grid content-start gap-4 p-5 sm:grid-cols-2">
    <h2 class="font-bold sm:col-span-2">Filters</h2>
    <select name="accountId" class="field">
      <option value="">All accounts</option>
      {#each data.accounts as account}
        <option value={account.id} selected={data.filters.accountId === account.id}>{account.name}</option>
      {/each}
    </select>
    <select name="assetId" class="field">
      <option value="">All assets</option>
      {#each data.assets as asset}
        <option value={asset.id} selected={data.filters.assetId === asset.id}>{asset.symbol}</option>
      {/each}
    </select>
    <select name="type" class="field">
      <option value="">All types</option>
      {#each transactionTypes as type}
        <option value={type} selected={data.filters.type === type}>{type}</option>
      {/each}
    </select>
    <input name="start" class="field" type="date" value={data.filters.start ?? ''} />
    <input name="end" class="field" type="date" value={data.filters.end ?? ''} />
    <div class="flex gap-2">
      <button class="button-secondary">Apply</button>
      <a href="/transactions" class="button-secondary">Clear</a>
    </div>
  </form>
</section>

<div class="space-y-4">
  {#each data.transactions as transaction}
    <details class="card p-5">
      <summary class="flex cursor-pointer list-none items-center justify-between gap-4">
        <div>
          <div class="font-bold">{transaction.asset?.symbol ?? transaction.type.toUpperCase()}</div>
          <div class="mt-1 text-sm text-slate-500">{transaction.account.name} - {date(transaction.tradeDate)}</div>
        </div>
        <div class="text-right text-sm">
          <div class="font-semibold capitalize">{transaction.type}</div>
          <div>{number(transaction.quantity)} @ {money(transaction.price, transaction.currency)}</div>
        </div>
      </summary>

      <form method="POST" action="?/update" class="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-4">
        <input type="hidden" name="transactionId" value={transaction.id} />
        <select name="accountId" class="field">
          {#each data.accounts as account}
            <option value={account.id} selected={transaction.accountId === account.id}>{account.name}</option>
          {/each}
        </select>
        <select name="type" class="field">
          {#each transactionTypes as type}
            <option value={type} selected={transaction.type === type}>{type}</option>
          {/each}
        </select>
        <select name="assetId" class="field sm:col-span-2">
          <option value="">Cash / no asset</option>
          {#each data.assets as asset}
            <option value={asset.id} selected={transaction.assetId === asset.id}>{asset.symbol} - {asset.name}</option>
          {/each}
        </select>
        <input name="tradeDate" class="field" type="date" value={inputDate(transaction.tradeDate)} />
        <input name="quantity" class="field" type="number" step="0.000001" value={transaction.quantity} />
        <input name="price" class="field" type="number" step="0.0001" value={transaction.price} />
        <input name="fee" class="field" type="number" step="0.0001" value={transaction.fee} />
        <input name="currency" class="field" value={transaction.currency} maxlength="3" />
        <input name="notes" class="field sm:col-span-3" value={transaction.notes ?? ''} />
        <button class="button-secondary"><Pencil size={16} /> Update</button>
      </form>
      <form method="POST" action="?/delete" class="mt-3">
        <input type="hidden" name="transactionId" value={transaction.id} />
        <button class="button-secondary text-danger"><Trash2 size={16} /> Delete</button>
      </form>
    </details>
  {/each}
  {#if data.transactions.length === 0}
    <div class="card p-6 text-sm text-slate-500">No transactions found.</div>
  {/if}
</div>
