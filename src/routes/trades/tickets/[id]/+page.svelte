<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import TradeApprovalCard from '$lib/components/trades/TradeApprovalCard.svelte';
  import TradeAuditTimeline from '$lib/components/trades/TradeAuditTimeline.svelte';
  import TradeTicketCard from '$lib/components/trades/TradeTicketCard.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;
</script>

<div class="page-top">
  <PageHeader title={`Ticket ${data.ticket.symbol}`} subtitle="Internal approval record with guardrail validation, approval history, and audit trail." breadcrumb={[{ label: 'Trades', href: '/trades' }, { label: 'Tickets', href: '/trades/tickets' }, { label: data.ticket.symbol }]} />
  <a class="button-secondary" href="/trades/tickets">Back to tickets</a>
</div>

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<div class="layout">
  <main class="main-col">
    <TradeTicketCard ticket={data.ticket} />
    <TradeAuditTimeline logs={data.ticket.auditLogs ?? []} />
  </main>
  <aside class="side-col">
    <section class="panel">
      <h2>Approval Actions</h2>
      {#if data.ticket.status === 'draft' || data.ticket.status === 'pending_approval'}
        <form method="POST" action="?/confirm_execute">
          <input type="hidden" name="ticketId" value={data.ticket.id} />
          <button class="button execute-btn" type="submit">Confirm &amp; Execute (Paper)</button>
        </form>
        <form method="POST" action="?/approve">
          <input type="hidden" name="ticketId" value={data.ticket.id} />
          <button class="button-secondary" type="submit">Approve Only</button>
        </form>
        <form method="POST" action="?/reject">
          <input type="hidden" name="ticketId" value={data.ticket.id} />
          <textarea class="field" name="note">Rejected after review.</textarea>
          <button class="button-secondary danger" type="submit">Reject</button>
        </form>
      {:else if data.ticket.status === 'approved'}
        <form method="POST" action="?/confirm_execute">
          <input type="hidden" name="ticketId" value={data.ticket.id} />
          <button class="button execute-btn" type="submit">Execute Now (Paper)</button>
        </form>
        <p>Ticket approved. Click above to submit to paper trading.</p>
      {:else}
        <p>This ticket is already {data.ticket.status.replaceAll('_', ' ')}.</p>
      {/if}
      {#if data.ticket.status !== 'approved' && data.ticket.status !== 'cancelled' && data.ticket.status !== 'expired'}
        <form method="POST" action="?/cancel">
          <input type="hidden" name="ticketId" value={data.ticket.id} />
          <button class="button-secondary" type="submit">Cancel Ticket</button>
        </form>
      {/if}
    </section>

    <section class="panel">
      <h2>Approvals</h2>
      {#if (data.ticket.approvals ?? []).length === 0}
        <p>No approval decision recorded yet.</p>
      {:else}
        {#each data.ticket.approvals ?? [] as approval}<TradeApprovalCard {approval} />{/each}
      {/if}
    </section>
  </aside>
</div>

<style>
  .page-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .notice { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .execute-btn { background: var(--primary); color: #fff; border-color: var(--primary); font-weight: 700; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 24rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  .panel { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 10px; }
  h2 { margin: 0; color: var(--text); font-size: 0.95rem; }
  p { margin: 0; color: var(--muted); font-size: 0.75rem; line-height: 1.45; }
  form { display: grid; gap: 8px; }
  textarea { min-height: 78px; padding-top: 10px; resize: vertical; }
  .danger { border-color: rgba(var(--danger-rgb), 0.26); color: var(--danger); }
  @media (max-width: 1040px) { .layout { grid-template-columns: 1fr; } .page-top { align-items: start; flex-direction: column; } }
</style>
