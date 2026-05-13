<script lang="ts">
  import type { PageData } from './$types';
  import { date, money, number } from '$lib/format';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import TransactionsTable from '$lib/components/portfolioai/tables/TransactionsTable.svelte';

  export let data: PageData;
  export let form: Record<string, unknown> = {};

  const transactionTypes = ['buy', 'sell', 'dividend', 'fee', 'deposit', 'withdrawal', 'split'];
  const today = new Date().toISOString().slice(0, 10);

  function inputDate(value: string | Date) {
    return new Date(value).toISOString().slice(0, 10);
  }

  let showForm = false;
</script>

<PageHeader
  title="Transactions"
  subtitle="Create, edit, delete, and filter manual transactions."
  breadcrumb={[{ label: 'Portfolio', href: '/dashboard' }, { label: 'Transactions' }]}
/>

{#if form?.message}
  <div class="form-msg">{form.message}</div>
{/if}

<div class="toolbar">
  <button class="button" on:click={() => (showForm = !showForm)}>
    {showForm ? '— Hide Form' : '+ Add Transaction'}
  </button>
</div>

{#if showForm}
  <section class="forms-grid">
    <form method="POST" action="?/create" class="card form-card">
      <h2 class="form-title">Add transaction</h2>
      <div class="form-row-2">
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
      <div class="form-row-4">
        <input name="tradeDate" class="field" type="date" value={today} required />
        <input name="quantity" class="field" type="number" step="0.000001" placeholder="Quantity" />
        <input name="price" class="field" type="number" step="0.0001" placeholder="Price / amount" />
        <input name="fee" class="field" type="number" step="0.0001" value="0" />
      </div>
      <div class="form-row-currency">
        <input name="currency" class="field" value="USD" maxlength="3" />
        <input name="notes" class="field" placeholder="Notes" />
      </div>
      <button class="button">Create transaction</button>
    </form>

    <form method="GET" class="card form-card">
      <h2 class="form-title">Filters</h2>
      <div class="form-row-2">
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
        <div class="filter-actions">
          <button class="button-secondary">Apply</button>
          <a href="/transactions" class="button-secondary">Clear</a>
        </div>
      </div>
    </form>
  </section>
{/if}

<TransactionsTable transactions={data.transactions} />

<style>
  .toolbar     { margin-bottom: 16px; }
  .form-msg    { margin-bottom: 16px; padding: 12px 16px; border-radius: 8px; border: 1px solid #1a2038; background: #0f1523; font-size: 0.82rem; color: #dce8ff; }
  .forms-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .form-card   { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  .form-title  { font-weight: 700; color: #dce8ff; font-size: 0.85rem; margin: 0; }
  .form-row-2  { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .form-row-4  { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .form-row-currency { display: grid; grid-template-columns: 0.3fr 0.7fr; gap: 10px; }
  .filter-actions { display: flex; gap: 8px; }
  @media (max-width: 900px) { .forms-grid { grid-template-columns: 1fr; } }
  @media (max-width: 640px) { .form-row-4 { grid-template-columns: 1fr 1fr; } }
</style>
