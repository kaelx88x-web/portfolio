<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import TradeApprovalCard from '$lib/components/trades/TradeApprovalCard.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<div class="page-top">
  <PageHeader title="Trade Approvals" subtitle="Internal approval and rejection history for Phase 6E tickets." breadcrumb={[{ label: 'Trades', href: '/trades' }, { label: 'Approvals' }]} />
  <a class="button-secondary" href="/trades/tickets">Tickets</a>
</div>

<div class="list">
  {#if data.approvals.length === 0}
    <div class="empty">No approval decisions yet.</div>
  {:else}
    {#each data.approvals as approval}<TradeApprovalCard {approval} />{/each}
  {/if}
</div>

<style>
  .page-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .list { display: grid; gap: 12px; }
  .empty { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; color: var(--muted); font-size: 0.78rem; }
  @media (max-width: 760px) { .page-top { align-items: start; flex-direction: column; } }
</style>
