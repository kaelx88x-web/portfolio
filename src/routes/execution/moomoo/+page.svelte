<script lang="ts">
  import { RefreshCw, ShieldCheck } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import ExecutionRequestCard from '$lib/components/execution/ExecutionRequestCard.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;
</script>

<div class="page-top">
  <PageHeader
    title="Moomoo Execution"
    subtitle="Explicit execution preview and submission layer for approved Phase 6E tickets."
    breadcrumb={[{ label: 'Trades', href: '/trades' }, { label: 'Moomoo Execution' }]}
  />
  <a class="button-secondary" href="/trades"><ShieldCheck size={15} /> Trade Layer</a>
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
      <h2>Execution Requests</h2>
      <span>Dry-run default: {data.dryRunEnabled ? 'on' : 'off'}</span>
    </section>
    {#if data.requests.length === 0}
      <div class="empty">No Moomoo execution requests yet.</div>
    {:else}
      {#each data.requests as execution}<ExecutionRequestCard {execution} />{/each}
    {/if}
  </main>

  <aside class="side-col">
    <form class="panel" method="POST" action="?/preview">
      <div>
        <span>Phase 6F</span>
        <h2>Create Preview</h2>
      </div>
      <label>
        <span>Approved Ticket</span>
        <select class="field" name="tradeTicketId" required>
          {#each data.approvedTickets as ticket}
            <option value={ticket.id}>{ticket.symbol} / {ticket.ticketType} / ${ticket.estimatedValue.toLocaleString()}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Mode</span>
        <select class="field" name="mode">
          <option value="dry_run">Dry Run</option>
          <option value="paper">Paper</option>
          <option value="live">Live</option>
        </select>
      </label>
      <label class="check">
        <input type="checkbox" name="overrideGuardrails" />
        <span>Allow guardrail override warning</span>
      </label>
      <button class="button" type="submit" disabled={data.approvedTickets.length === 0}><RefreshCw size={15} /> Preview</button>
      {#if data.approvedTickets.length === 0}<p>No approved trade tickets available. Approve a 6E ticket first.</p>{/if}
    </form>

    <section class="panel">
      <div>
        <span>Safety</span>
        <h2>Execution Flags</h2>
      </div>
      <p>Trade execution: {data.executionEnabled ? 'enabled' : 'disabled'}</p>
      <p>Live execution: {data.liveExecutionEnabled ? 'enabled' : 'disabled'}</p>
      <p>Dry-run execution: {data.dryRunEnabled ? 'enabled' : 'disabled'}</p>
    </section>
  </aside>
</div>

<style>
  .page-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .notice, .safety { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .safety { border-color: rgba(var(--primary-rgb), 0.22); background: rgba(var(--primary-rgb), 0.06); color: var(--muted); }
  .widget-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 12px; }
  .widget-row article, .panel, .empty { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  .widget-row article.medium { border-color: rgba(var(--warning-rgb), 0.28); }
  .widget-row article.high { border-color: rgba(var(--danger-rgb), 0.28); }
  .widget-row span, .panel span, .section-head span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  .widget-row strong { display: block; margin-top: 6px; color: var(--text); font-size: 1rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 25rem; gap: 12px; }
  .main-col, .side-col, .panel { display: grid; align-content: start; gap: 12px; }
  .section-head { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
  h2 { margin: 3px 0 0; color: var(--text); font-size: 0.98rem; }
  label { display: grid; gap: 6px; }
  .check { display: flex; align-items: center; gap: 8px; }
  p, .empty { margin: 0; color: var(--muted); font-size: 0.75rem; line-height: 1.45; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } .page-top { align-items: start; flex-direction: column; } }
</style>
