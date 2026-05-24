<script lang="ts">
  import { Activity, RefreshCw } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import OrderCard from '$lib/components/orders/OrderCard.svelte';
  import ReconciliationCard from '$lib/components/orders/ReconciliationCard.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;
</script>

<div class="page-top">
  <PageHeader
    title="Order Tracking"
    subtitle="Broker order lifecycle, fills, events, and reconciliation visibility."
    breadcrumb={[{ label: 'Execution', href: '/execution/moomoo' }, { label: 'Orders' }]}
  />
  <div class="actions">
    <a class="button-secondary" href="/orders/activity"><Activity size={15} /> Activity</a>
    <form method="POST" action="?/sync"><button class="button" type="submit"><RefreshCw size={15} /> Sync</button></form>
  </div>
</div>

{#if form?.message}<div class="notice">{form.message}</div>{/if}
<div class="safety">{data.safetyMessage}</div>

<div class="widget-row">
  {#each data.widgets as widget}
    <article class:high={widget.status === 'high'} class:medium={widget.status === 'medium'}>
      <span>{widget.label}</span>
      <strong>{widget.value}</strong>
    </article>
  {/each}
</div>

<div class="layout">
  <main class="main-col">
    <section class="section-head"><h2>Tracked Orders</h2></section>
    {#if data.orders.length === 0}
      <div class="empty">No tracked orders yet. Submit a 6F dry-run or sync broker orders.</div>
    {:else}
      {#each data.orders as order}<OrderCard {order} />{/each}
    {/if}
  </main>
  <aside class="side-col">
    <section class="panel">
      <h2>Latest Reconciliation</h2>
      {#if data.reconciliations.length === 0}
        <p>No reconciliation logs yet.</p>
      {:else}
        {#each data.reconciliations.slice(0, 6) as log}<ReconciliationCard {log} />{/each}
      {/if}
    </section>
  </aside>
</div>

<style>
  .page-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .notice, .safety { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .safety { border-color: rgba(var(--primary-rgb), 0.22); background: rgba(var(--primary-rgb), 0.06); color: var(--muted); }
  .widget-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 12px; }
  .widget-row article, .panel, .empty { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  .widget-row article.medium { border-color: rgba(var(--warning-rgb), 0.28); }
  .widget-row article.high { border-color: rgba(var(--danger-rgb), 0.28); }
  .widget-row span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  .widget-row strong { display: block; margin-top: 6px; color: var(--text); font-size: 1rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 25rem; gap: 12px; }
  .main-col, .side-col, .panel { display: grid; align-content: start; gap: 12px; }
  .section-head h2, .panel h2 { margin: 0; color: var(--text); font-size: 0.98rem; }
  p, .empty { margin: 0; color: var(--muted); font-size: 0.75rem; line-height: 1.45; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } .page-top { align-items: start; flex-direction: column; } }
</style>
