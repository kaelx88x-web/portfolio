<script lang="ts">
  import { money, number } from '$lib/format';
  import { Pencil, Trash2 } from 'lucide-svelte';

  export let data;
  export let form;

  function accountValue(accountId: string) {
    return data.holdings
      .filter((holding) => holding.accountId === accountId)
      .reduce((sum, holding) => sum + holding.marketValue, 0);
  }
</script>

<div class="mb-6">
  <h1 class="text-2xl font-bold">Accounts</h1>
  <p class="mt-1 text-sm text-slate-500">Track broker, cash, crypto, or manual accounts.</p>
</div>

{#if form?.message}
  <div class="mb-4 rounded-md border border-line bg-white px-4 py-3 text-sm">{form.message}</div>
{/if}

<section class="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
  <form method="POST" action="?/create" class="card space-y-4 p-5">
    <h2 class="font-bold">Add account</h2>
    <div>
      <label class="label" for="name">Name</label>
      <input id="name" name="name" class="field mt-1" placeholder="Moomoo US Account" required />
    </div>
    <div class="grid gap-4 sm:grid-cols-2">
      <div>
        <label class="label" for="brokerName">Broker</label>
        <input id="brokerName" name="brokerName" class="field mt-1" placeholder="Moomoo" required />
      </div>
      <div>
        <label class="label" for="accountType">Type</label>
        <select id="accountType" name="accountType" class="field mt-1">
          <option value="brokerage">Brokerage</option>
          <option value="cash">Cash</option>
          <option value="crypto">Crypto wallet</option>
          <option value="retirement">Retirement</option>
        </select>
      </div>
    </div>
    <div>
      <label class="label" for="currency">Currency</label>
      <input id="currency" name="currency" class="field mt-1" value="USD" maxlength="3" required />
    </div>
    <button class="button">Create account</button>
  </form>

  <div class="space-y-4">
    {#each data.accounts as account}
      <details class="card group p-5">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-4">
          <div>
            <div class="font-bold">{account.name}</div>
            <div class="mt-1 text-sm text-slate-500">{account.brokerName} - {account.accountType} - {account.currency}</div>
          </div>
          <div class="text-right">
            <div class="label">Holdings value</div>
            <div class="font-bold">{money(accountValue(account.id), account.currency)}</div>
          </div>
        </summary>

        <div class="mt-5 grid gap-5 border-t border-line pt-5 xl:grid-cols-[1fr_0.7fr]">
          <form method="POST" action="?/update" class="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="accountId" value={account.id} />
            <input name="name" class="field" value={account.name} aria-label="Name" />
            <input name="brokerName" class="field" value={account.brokerName} aria-label="Broker" />
            <input name="accountType" class="field" value={account.accountType} aria-label="Type" />
            <input name="currency" class="field" value={account.currency} maxlength="3" aria-label="Currency" />
            <button class="button-secondary sm:col-span-2"><Pencil size={16} /> Update</button>
          </form>
          <div>
            <div class="mb-2 text-sm font-semibold">Holdings</div>
            <div class="space-y-2">
              {#each data.holdings.filter((holding) => holding.accountId === account.id) as holding}
                <div class="flex justify-between rounded-md bg-panel px-3 py-2 text-sm">
                  <span>{holding.symbol} x {number(holding.quantity)}</span>
                  <span class="font-semibold">{money(holding.marketValue, holding.currency)}</span>
                </div>
              {/each}
            </div>
            <form method="POST" action="?/delete" class="mt-4">
              <input type="hidden" name="accountId" value={account.id} />
              <button class="button-secondary text-danger"><Trash2 size={16} /> Delete</button>
            </form>
          </div>
        </div>
      </details>
    {/each}
  </div>
</section>
