<script lang="ts">
  import { RefreshCw } from 'lucide-svelte';
  import type { BrokerOrder } from '$lib/services/order-tracking.service';

  export let order: BrokerOrder;
  export let showActions = true;
</script>

<article class="order" class:mismatch={order.status === 'failed' || order.status === 'rejected'} class:filled={order.status === 'filled'}>
  <div class="top">
    <div>
      <span>{order.broker} / {order.side}</span>
      <h2>{order.symbol}</h2>
    </div>
    <div class="status">{order.status.replaceAll('_', ' ')}</div>
  </div>

  <div class="facts">
    <div><span>Broker ID</span><strong>{order.brokerOrderId}</strong></div>
    <div><span>Quantity</span><strong>{order.filledQuantity.toLocaleString()} / {order.quantity.toLocaleString()}</strong></div>
    <div><span>Order</span><strong>{order.orderType}{order.limitPrice ? ` @ $${order.limitPrice}` : ''}</strong></div>
    <div><span>Average Fill</span><strong>{order.averageFillPrice ? `$${order.averageFillPrice}` : '-'}</strong></div>
  </div>

  <div class="foot">
    <a class="button-secondary" href={`/orders/${order.id}`}>Details</a>
    {#if showActions}
      <form method="POST" action="?/reconcile">
        <input type="hidden" name="orderId" value={order.id} />
        <button class="button-secondary" type="submit"><RefreshCw size={15} /> Reconcile</button>
      </form>
    {/if}
  </div>
</article>

<style>
  .order { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 11px; }
  .order.mismatch { border-color: rgba(var(--danger-rgb), 0.28); }
  .order.filled { border-color: rgba(var(--success-rgb), 0.28); }
  .top { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
  .top span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  h2 { margin: 3px 0 0; color: var(--text); font-size: 1rem; }
  .status { border: 1px solid rgba(var(--primary-rgb), 0.22); border-radius: 999px; background: rgba(var(--primary-rgb), 0.07); color: var(--primary); padding: 4px 8px; font-size: 0.62rem; font-weight: 800; text-transform: uppercase; white-space: nowrap; }
  .facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .facts div { border: 1px solid var(--border); border-radius: 7px; padding: 9px; background: rgba(var(--primary-rgb), 0.03); min-width: 0; }
  .facts span { color: var(--muted); display: block; font-size: 0.62rem; font-weight: 800; text-transform: uppercase; }
  .facts strong { display: block; margin-top: 4px; color: var(--text); font-size: 0.76rem; overflow-wrap: anywhere; }
  .foot { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  @media (max-width: 760px) { .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
