<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AccountCard from '$lib/components/portfolioai/AccountCard.svelte';
  import EmptyState from '$lib/components/portfolioai/EmptyState.svelte';

  export let data: PageData;
  export let form: ActionData;

  let showCreateForm = false;

  function accountBalance(accountId: string): number {
    // Moomoo live account — use snapshot.totalValue (includes cash + holdings)
    if (data.snapshotAccountId && accountId === data.snapshotAccountId && data.snapshotTotalValue > 0) {
      return data.snapshotTotalValue;
    }
    // Sum holdings from transaction records + manually-set cash balance
    const holdingsValue = (data.holdings ?? [])
      .filter((h: { accountId: string; marketValue: number }) => h.accountId === accountId)
      .reduce((s: number, h: { marketValue: number }) => s + h.marketValue, 0);
    const account = data.accounts.find((a) => a.id === accountId);
    const cashBalance = (account as any)?.cashBalance ?? 0;
    return holdingsValue + cashBalance;
  }

  function accountDayPnl(accountId: string): number | null {
    if (data.snapshotAccountId && accountId === data.snapshotAccountId) {
      return data.snapshotDayPl ?? null;
    }
    return null; // no day P&L for manual accounts without live prices
  }

  function accountLastSynced(accountId: string): Date | null {
    if (data.snapshotAccountId && accountId === data.snapshotAccountId) {
      return data.snapshotDate ?? null;
    }
    return null;
  }
</script>

<div class="page-top">
  <PageHeader
    title="Accounts"
    subtitle="Track broker, cash, crypto, or manual accounts."
    breadcrumb={[{ label: 'Portfolio', href: '/dashboard' }, { label: 'Accounts' }]}
  />
  <div class="page-actions">
    <button class="button" on:click={() => (showCreateForm = !showCreateForm)}>
      {showCreateForm ? '— Hide Form' : '+ Add Account'}
    </button>
  </div>
</div>

{#if form?.message}
  <div class="form-msg" class:form-msg-err={form && 'status' in form && (form as any).status >= 400}>
    {form.message}
  </div>
{/if}

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
      <AccountCard
        {account}
        balance={accountBalance(account.id)}
        dayPnl={accountDayPnl(account.id)}
        lastSynced={accountLastSynced(account.id)}
      />
    {/each}
  </div>
{/if}

<style>
  .page-top    { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .page-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .form-msg        { margin-bottom: 16px; padding: 12px 16px; border-radius: 8px; border: 1px solid rgba(var(--success-rgb),0.3); background: rgba(var(--success-rgb),0.06); font-size: 0.82rem; color: var(--success); }
  .form-msg-err    { border-color: rgba(var(--danger-rgb),0.3); background: rgba(var(--danger-rgb),0.06); color: var(--danger); }
  .create-form { padding: 20px; margin-bottom: 24px; display: flex; flex-direction: column; gap: 16px; max-width: 600px; }
  .form-title  { font-weight: 700; color: var(--text); font-size: 0.85rem; margin: 0; }
  .form-row-2  { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .ac-grid     { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
  @media (max-width: 640px) { .form-row-2 { grid-template-columns: 1fr; } }
</style>
