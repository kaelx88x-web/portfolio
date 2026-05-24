<script lang="ts">
  import { Check, FileText, ShieldCheck, X } from 'lucide-svelte';
  import TradeGuardrailPanel from './TradeGuardrailPanel.svelte';
  import type { TradeTicket } from '$lib/services/trade-layer.service';

  export let ticket: TradeTicket;
  export let showActions = true;
</script>

<article class="ticket" class:high={ticket.riskLevel === 'high'} class:approved={ticket.status === 'approved'}>
  <div class="top">
    <div>
      <span>{ticket.ticketType.replaceAll('_', ' ')} / {ticket.side}</span>
      <h2>{ticket.symbol}</h2>
    </div>
    <div class="status">{ticket.status.replaceAll('_', ' ')}</div>
  </div>

  <p>{ticket.thesis}</p>

  <div class="facts">
    <div><span>Quantity</span><strong>{ticket.quantity.toLocaleString()}</strong></div>
    <div><span>Order</span><strong>{ticket.orderType}{ticket.limitPrice ? ` @ $${ticket.limitPrice}` : ''}</strong></div>
    <div><span>Estimate</span><strong>${ticket.estimatedValue.toLocaleString()}</strong></div>
    <div><span>Risk</span><strong>{ticket.riskLevel}</strong></div>
  </div>

  <TradeGuardrailPanel guardrail={ticket.guardrail} />

  <div class="foot">
    <a class="button-secondary" href={`/trades/tickets/${ticket.id}`}><FileText size={15} /> Details</a>
    {#if showActions}
      {#if ticket.status === 'draft' || ticket.status === 'pending_approval'}
        <form method="POST" action="?/approve">
          <input type="hidden" name="ticketId" value={ticket.id} />
          <button class="button" type="submit"><Check size={15} /> Approve</button>
        </form>
        <form method="POST" action="?/reject">
          <input type="hidden" name="ticketId" value={ticket.id} />
          <button class="button-secondary danger" type="submit"><X size={15} /> Reject</button>
        </form>
      {/if}
      {#if ticket.status !== 'approved' && ticket.status !== 'cancelled' && ticket.status !== 'expired'}
        <form method="POST" action="?/cancel">
          <input type="hidden" name="ticketId" value={ticket.id} />
          <button class="icon-button" type="submit" title="Cancel ticket"><ShieldCheck size={15} /></button>
        </form>
      {/if}
    {/if}
  </div>
</article>

<style>
  .ticket { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 11px; }
  .ticket.high { border-color: rgba(var(--danger-rgb), 0.3); }
  .ticket.approved { border-color: rgba(var(--success-rgb), 0.3); }
  .top { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
  .top span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  h2 { margin: 3px 0 0; color: var(--text); font-size: 1rem; }
  p { margin: 0; color: var(--muted); font-size: 0.76rem; line-height: 1.5; }
  .status { border: 1px solid rgba(var(--primary-rgb), 0.2); border-radius: 999px; background: rgba(var(--primary-rgb), 0.08); color: var(--primary); padding: 4px 8px; font-size: 0.62rem; font-weight: 800; text-transform: uppercase; white-space: nowrap; }
  .facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .facts div { border: 1px solid var(--border); border-radius: 7px; padding: 9px; background: rgba(var(--primary-rgb), 0.03); min-width: 0; }
  .facts span { color: var(--muted); display: block; font-size: 0.62rem; font-weight: 800; text-transform: uppercase; }
  .facts strong { display: block; margin-top: 4px; color: var(--text); font-size: 0.78rem; overflow-wrap: anywhere; }
  .foot { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .danger { border-color: rgba(var(--danger-rgb), 0.26); color: var(--danger); }
  @media (max-width: 760px) { .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
