<script lang="ts">
  import { ClipboardList, ShieldCheck } from 'lucide-svelte';
  import { page } from '$app/stores';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import TradeTicketCard from '$lib/components/trades/TradeTicketCard.svelte';
  import TradeTicketForm from '$lib/components/trades/TradeTicketForm.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  // Pre-fill from rebalance suggestion URL params
  $: prefillSymbol    = $page.url.searchParams.get('symbol') ?? '';
  $: prefillType      = ($page.url.searchParams.get('ticketType') ?? 'buy') as 'buy' | 'sell' | 'covered_call' | 'cash_secured_put';
  $: prefillThesis    = $page.url.searchParams.get('thesis') ?? '';
  $: prefillSource    = $page.url.searchParams.get('sourceType') ?? 'manual';
  $: fromRebalance    = prefillSymbol !== '';
</script>

<div class="page-top">
  <PageHeader
    title="Trade Layer"
    subtitle="Internal trade ticket and approval workflow. Phase 6E does not submit broker orders."
    breadcrumb={[{ label: 'Portfolio', href: '/dashboard' }, { label: 'Trades' }]}
  />
  <div class="actions">
    <a class="button-secondary" href="/trades/tickets"><ClipboardList size={15} /> Tickets</a>
    <a class="button-secondary" href="/trades/approvals"><ShieldCheck size={15} /> Approvals</a>
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
    <section class="section-head">
      <h2>Latest Tickets</h2>
      <a href="/trades/tickets">View all</a>
    </section>
    {#if data.tickets.length === 0}
      <div class="empty">No trade tickets yet.</div>
    {:else}
      {#each data.tickets.slice(0, 6) as ticket}<TradeTicketCard {ticket} />{/each}
    {/if}
  </main>

  <aside class="side-col">
    {#if fromRebalance}
      <div class="from-rebalance">
        <span>From Rebalance Suggestion</span>
        <strong>{prefillSymbol} — {prefillType.replaceAll('_', ' ')}</strong>
      </div>
    {/if}
    <TradeTicketForm
      symbol={prefillSymbol}
      ticketType={prefillType}
      thesis={prefillThesis}
      sourceType={prefillSource}
    />

    <section class="suggestions">
      <div class="section-head compact">
        <h2>AI Draft Starters</h2>
      </div>
      {#if data.suggestedDrafts.length === 0}
        <p>No AI recommendation draft available.</p>
      {:else}
        {#each data.suggestedDrafts as item}
          <form method="POST" action="?/create" class="draft">
            <input type="hidden" name="sourceType" value="strategy_recommendation" />
            <input type="hidden" name="sourceId" value={item.sourceRecommendation.id} />
            <input type="hidden" name="ticketType" value={item.draft.ticketType} />
            <input type="hidden" name="symbol" value={item.draft.symbol} />
            <input type="hidden" name="quantity" value={item.draft.quantity} />
            <input type="hidden" name="orderType" value={item.draft.orderType} />
            <input type="hidden" name="limitPrice" value={item.draft.limitPrice} />
            <input type="hidden" name="thesis" value={item.draft.thesis} />
            <span>{item.draft.ticketType.replaceAll('_', ' ')}</span>
            <strong>{item.sourceRecommendation.title}</strong>
            <p>{item.sourceRecommendation.summary}</p>
            <button class="button-secondary" type="submit">Create Draft</button>
          </form>
        {/each}
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
  .widget-row article { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  .widget-row article.medium { border-color: rgba(var(--warning-rgb), 0.28); }
  .widget-row article.high { border-color: rgba(var(--danger-rgb), 0.28); }
  .widget-row span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  .widget-row strong { display: block; margin-top: 6px; color: var(--text); font-size: 1rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 25rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  .section-head { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
  .section-head h2 { margin: 0; color: var(--text); font-size: 1rem; }
  .section-head a { color: var(--primary); font-size: 0.76rem; text-decoration: none; font-weight: 700; }
  .compact { margin-bottom: 4px; }
  .empty, .suggestions { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; color: var(--muted); font-size: 0.78rem; }
  .suggestions { display: grid; gap: 10px; }
  .suggestions p { margin: 0; color: var(--muted); font-size: 0.74rem; line-height: 1.45; }
  .draft { border: 1px solid var(--border); border-radius: 8px; padding: 10px; display: grid; gap: 8px; }
  .draft span { color: var(--muted); font-size: 0.62rem; font-weight: 800; text-transform: uppercase; }
  .draft strong { color: var(--text); font-size: 0.82rem; }
  .from-rebalance { border: 1px solid rgba(var(--primary-rgb), 0.3); border-radius: 8px; background: rgba(var(--primary-rgb), 0.06); padding: 10px 14px; display: grid; gap: 3px; }
  .from-rebalance span { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--primary); }
  .from-rebalance strong { font-size: 0.84rem; color: var(--text); text-transform: capitalize; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } .page-top { align-items: start; flex-direction: column; } }
</style>
