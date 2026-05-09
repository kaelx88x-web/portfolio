<script lang="ts">
  export let form;

  const sample = `account,symbol,type,trade_date,quantity,price,fee,currency,notes
Moomoo US Account,MSFT,buy,2026-05-01,10,420,1,USD,Initial Microsoft buy
Moomoo US Account,AAPL,dividend,2026-05-08,20,0.24,0,USD,Quarterly dividend`;
</script>

<div class="mb-6">
  <h1 class="text-2xl font-bold">CSV Import</h1>
  <p class="mt-1 text-sm text-slate-500">Preview rows, validate basic fields, then confirm import.</p>
</div>

{#if form?.message}
  <div class="mb-4 rounded-md border border-line bg-white px-4 py-3 text-sm">{form.message}</div>
{/if}

<section class="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
  <div class="card p-5">
    <form method="POST" action="?/preview" enctype="multipart/form-data" class="space-y-4">
      <h2 class="font-bold">Upload CSV</h2>
      <input name="csv" type="file" accept=".csv,text/csv" class="field h-auto py-2" required />
      <button class="button">Preview import</button>
    </form>

    {#if form?.csvContent}
      <form method="POST" action="?/confirm" class="mt-4 border-t border-line pt-4">
        <textarea name="csvContent" class="hidden">{form.csvContent}</textarea>
        <button class="button">Confirm valid import</button>
      </form>
    {/if}
  </div>

  <div class="card p-5">
    <h2 class="font-bold">Expected columns</h2>
    <pre class="mt-4 overflow-x-auto rounded-md bg-ink p-4 text-xs text-white">{sample}</pre>
  </div>
</section>

{#if form?.rows?.length}
  <div class="mt-6 table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th>Account</th>
          <th>Symbol</th>
          <th>Type</th>
          <th>Date</th>
          <th>Quantity</th>
          <th>Price</th>
          <th>Fee</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-line">
        {#each form.rows as row}
          <tr>
            <td>{row.account}</td>
            <td>{row.symbol}</td>
            <td>{row.type}</td>
            <td>{row.tradeDate}</td>
            <td>{row.quantity}</td>
            <td>{row.price}</td>
            <td>{row.fee}</td>
            <td>
              {#if row.errors.length}
                <span class="negative">{row.errors.join(', ')}</span>
              {:else}
                <span class="positive">Ready</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
