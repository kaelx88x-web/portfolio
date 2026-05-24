<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import OrderCard from '$lib/components/orders/OrderCard.svelte';
  import OrderTimeline from '$lib/components/orders/OrderTimeline.svelte';
  import ReconciliationCard from '$lib/components/orders/ReconciliationCard.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;
</script>

<div class="page-top">
  <PageHeader title={`Order ${data.order.symbol}`} subtitle="Order lifecycle details, fills, and reconciliation logs." breadcrumb={[{ label: 'Orders', href: '/orders' }, { label: data.order.symbol }]} />
  <a class="button-secondary" href="/orders">Back</a>
</div>

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<div class="layout">
  <main class="main-col">
    <OrderCard order={data.order} />
    <OrderTimeline events={data.order.events ?? []} />
  </main>
  <aside class="side-col">
    <section class="panel">
      <h2>Fills</h2>
      {#if (data.order.fills ?? []).length === 0}
        <p>No fills recorded.</p>
      {:else}
        {#each data.order.fills ?? [] as fill}
          <article class="fill">
            <span>{fill.brokerFillId}</span>
            <strong>{fill.quantity.toLocaleString()} @ ${fill.price}</strong>
            <p>{fill.executedAt ? new Date(fill.executedAt).toLocaleString() : 'No broker time'}</p>
          </article>
        {/each}
      {/if}
    </section>
    <section class="panel">
      <h2>Reconciliation</h2>
      {#if (data.order.reconciliations ?? []).length === 0}
        <p>No reconciliation logs.</p>
      {:else}
        {#each data.order.reconciliations ?? [] as log}<ReconciliationCard {log} />{/each}
      {/if}
    </section>
  </aside>
</div>

<style>
  .page-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .notice { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 24rem; gap: 12px; }
  .main-col, .side-col, .panel { display: grid; align-content: start; gap: 12px; }
  .panel, .fill { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  .fill { display: grid; gap: 4px; }
  h2 { margin: 0; color: var(--text); font-size: 0.95rem; }
  span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; overflow-wrap: anywhere; }
  strong { color: var(--text); font-size: 0.82rem; }
  p { margin: 0; color: var(--muted); font-size: 0.74rem; line-height: 1.45; }
  @media (max-width: 1040px) { .layout { grid-template-columns: 1fr; } .page-top { align-items: start; flex-direction: column; } }
</style>
