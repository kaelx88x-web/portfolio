<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import TradeTicketCard from '$lib/components/trades/TradeTicketCard.svelte';
  import TradeTicketForm from '$lib/components/trades/TradeTicketForm.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;
</script>

<div class="page-top">
  <PageHeader title="Trade Tickets" subtitle="Draft, approve, reject, or cancel internal trade tickets before any future execution layer." breadcrumb={[{ label: 'Trades', href: '/trades' }, { label: 'Tickets' }]} />
  <a class="button-secondary" href="/trades/approvals">Approvals</a>
</div>

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<div class="layout">
  <main class="list">
    {#if data.tickets.length === 0}
      <div class="empty">No trade tickets yet.</div>
    {:else}
      {#each data.tickets as ticket}<TradeTicketCard {ticket} />{/each}
    {/if}
  </main>
  <aside><TradeTicketForm /></aside>
</div>

<style>
  .page-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .notice { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 25rem; gap: 12px; }
  .list, aside { display: grid; align-content: start; gap: 12px; }
  .empty { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; color: var(--muted); font-size: 0.78rem; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } .page-top { align-items: start; flex-direction: column; } }
</style>
