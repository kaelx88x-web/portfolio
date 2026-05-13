<script lang="ts">
  import type { PageData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AccountCard from '$lib/components/portfolioai/AccountCard.svelte';
  import EmptyState from '$lib/components/portfolioai/EmptyState.svelte';

  export let data: PageData;
  export let form: Record<string, unknown> = {};

  let showCreateForm = false;

  function accountBalance(accountId: string): number {
    if (data.snapshotAccountId && accountId === data.snapshotAccountId && data.snapshotValue > 0) {
      return data.snapshotValue;
    }
    return (data.holdings ?? [])
      .filter((h: { accountId: string; marketValue: number }) => h.accountId === accountId)
      .reduce((s: number, h: { marketValue: number }) => s + h.marketValue, 0);
  }
</script>

<PageHeader
  title="Accounts"
  subtitle="Track broker, cash, crypto, or manual accounts."
  breadcrumb={[{ label: 'Portfolio', href: '/dashboard' }, { label: 'Accounts' }]}
/>

{#if form?.message}
  <div class="form-msg">{form.message}</div>
{/if}

<div class="toolbar">
  <button class="button" on:click={() => (showCreateForm = !showCreateForm)}>
    {showCreateForm ? '— Hide Form' : '+ Add Account'}
  </button>
</div>

{#if showCreateForm}
  <form method="POST" action="?/create" class="card create-form">
    <h2 class="form-title">Add account</h2>
    <div class="form-row-2">
      <div>
        <label class="label" for="name">Name</label>
        <input id="name" name="name" class="field mt-1" placeholder="Moomoo US Account" required />
      </div>
      <div>
        <label class="label" for="brokerName">Broker</label>
        <input id="brokerName" name="brokerName" class="field mt-1" placeholder="Moomoo" required />
      </div>
      <div>
        <label class="label" for="accountType">Type</label>
        <select id="accountType" name="accountType" class="field mt-1">
          <option value="brokerage">Brokerage</option>
          <option value="paper">Simulated / Paper</option>
          <option value="cash">Cash</option>
          <option value="crypto">Crypto wallet</option>
          <option value="retirement">Retirement</option>
        </select>
      </div>
      <div>
        <label class="label" for="currency">Currency</label>
        <input id="currency" name="currency" class="field mt-1" value="USD" maxlength="3" required />
      </div>
    </div>
    <button class="button">Create account</button>
  </form>
{/if}

{#if data.accounts.length === 0}
  <EmptyState
    icon="🏦"
    title="No accounts yet"
    description="Add a broker account or create a sandbox for paper trading."
  />
{:else}
  <div class="ac-grid">
    {#each data.accounts as account}
      <AccountCard {account} balance={accountBalance(account.id)} />
    {/each}
  </div>
{/if}

<style>
  .toolbar     { margin-bottom: 16px; }
  .form-msg    { margin-bottom: 16px; padding: 12px 16px; border-radius: 8px; border: 1px solid #1a2038; background: #0f1523; font-size: 0.82rem; color: #dce8ff; }
  .create-form { padding: 20px; margin-bottom: 24px; display: flex; flex-direction: column; gap: 16px; max-width: 600px; }
  .form-title  { font-weight: 700; color: #dce8ff; font-size: 0.85rem; margin: 0; }
  .form-row-2  { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .ac-grid     { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
  @media (max-width: 640px) { .form-row-2 { grid-template-columns: 1fr; } }
</style>
