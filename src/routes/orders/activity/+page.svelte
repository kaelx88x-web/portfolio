<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import OrderTimeline from '$lib/components/orders/OrderTimeline.svelte';
  import ReconciliationCard from '$lib/components/orders/ReconciliationCard.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<div class="page-top">
  <PageHeader title="Order Activity" subtitle="Append-only order events and reconciliation activity." breadcrumb={[{ label: 'Orders', href: '/orders' }, { label: 'Activity' }]} />
  <a class="button-secondary" href="/orders">Orders</a>
</div>

<div class="layout">
  <OrderTimeline events={data.events} />
  <section class="panel">
    <h2>Reconciliation Logs</h2>
    {#if data.reconciliations.length === 0}
      <p>No reconciliation logs.</p>
    {:else}
      {#each data.reconciliations as log}<ReconciliationCard {log} />{/each}
    {/if}
  </section>
</div>

<style>
  .page-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 24rem; gap: 12px; align-items: start; }
  .panel { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 12px; }
  h2 { margin: 0; color: var(--text); font-size: 0.95rem; }
  p { margin: 0; color: var(--muted); font-size: 0.74rem; line-height: 1.45; }
  @media (max-width: 1040px) { .layout { grid-template-columns: 1fr; } .page-top { align-items: start; flex-direction: column; } }
</style>
