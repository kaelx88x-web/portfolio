<script lang="ts">
  import { PlusCircle } from 'lucide-svelte';
  import type { TradeTicketType } from '$lib/services/trade-layer.service';

  export let title = 'Create Trade Ticket';
  export let sourceType = 'manual';
  export let sourceId: string | null = null;
  export let symbol = '';
  export let ticketType: TradeTicketType = 'buy';
  export let thesis = '';
</script>

<form class="form" method="POST" action="?/create">
  <div class="form-head">
    <div>
      <span>Phase 6E</span>
      <h2>{title}</h2>
    </div>
    <button class="button" type="submit"><PlusCircle size={15} /> Create</button>
  </div>

  <input type="hidden" name="sourceType" value={sourceType} />
  {#if sourceId}<input type="hidden" name="sourceId" value={sourceId} />{/if}

  <label>
    <span>Ticket Type</span>
    <select class="field" name="ticketType" bind:value={ticketType}>
      <option value="buy">Buy</option>
      <option value="sell">Sell</option>
      <option value="covered_call">Covered Call</option>
      <option value="cash_secured_put">Cash-Secured Put</option>
    </select>
  </label>

  <div class="grid">
    <label>
      <span>Symbol</span>
      <input class="field" name="symbol" bind:value={symbol} placeholder="AAPL" required />
    </label>
    <label>
      <span>Quantity</span>
      <input class="field" name="quantity" type="number" min="0.0001" step="0.0001" value="1" required />
    </label>
  </div>

  <div class="grid">
    <label>
      <span>Order Type</span>
      <select class="field" name="orderType">
        <option value="limit">Limit</option>
        <option value="market">Market</option>
      </select>
    </label>
    <label>
      <span>Limit Price</span>
      <input class="field" name="limitPrice" type="number" min="0" step="0.01" value="1" />
    </label>
  </div>

  <label>
    <span>Thesis</span>
    <textarea class="field thesis" name="thesis" bind:value={thesis} placeholder="Why this ticket should be reviewed"></textarea>
  </label>

  <p>No broker order is submitted. Approval only moves the internal ticket to approved status.</p>
</form>

<style>
  .form { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 11px; }
  .form-head { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
  .form-head span, label span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  h2 { margin: 3px 0 0; color: var(--text); font-size: 0.95rem; }
  label { display: grid; gap: 6px; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .thesis { min-height: 92px; padding-top: 10px; resize: vertical; }
  p { margin: 0; color: var(--muted); font-size: 0.72rem; line-height: 1.45; }
  @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } .form-head { align-items: start; flex-direction: column; } }
</style>
