<script lang="ts">
  import { Send, X } from 'lucide-svelte';
  import ExecutionSafetyPanel from './ExecutionSafetyPanel.svelte';
  import type { BrokerExecutionRequest } from '$lib/services/moomoo-execution.service';

  export let execution: BrokerExecutionRequest;
  export let showActions = true;
</script>

<article class="execution" class:blocked={execution.status === 'blocked'} class:submitted={execution.status === 'submitted'}>
  <div class="top">
    <div>
      <span>{execution.executionMode} / {execution.side}</span>
      <h2>{execution.brokerSymbol}</h2>
    </div>
    <div class="status">{execution.status}</div>
  </div>

  <div class="facts">
    <div><span>Quantity</span><strong>{execution.quantity.toLocaleString()}</strong></div>
    <div><span>Order</span><strong>{execution.orderType}{execution.limitPrice ? ` @ $${execution.limitPrice}` : ''}</strong></div>
    <div><span>Estimate</span><strong>${execution.estimatedValue.toLocaleString()}</strong></div>
    <div><span>Broker</span><strong>Moomoo</strong></div>
  </div>

  <ExecutionSafetyPanel {execution} />

  <div class="foot">
    <a class="button-secondary" href={`/execution/moomoo/requests/${execution.id}`}>Details</a>
    {#if showActions && execution.status === 'previewed' && !execution.safety.blocked}
      <form method="POST" action="?/submit">
        <input type="hidden" name="executionRequestId" value={execution.id} />
        <button class="button" type="submit"><Send size={15} /> Submit</button>
      </form>
    {/if}
    {#if showActions && execution.status !== 'cancelled'}
      <form method="POST" action="?/cancel">
        <input type="hidden" name="executionRequestId" value={execution.id} />
        <button class="button-secondary danger" type="submit"><X size={15} /> Cancel</button>
      </form>
    {/if}
  </div>
</article>

<style>
  .execution { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 11px; }
  .execution.blocked { border-color: rgba(var(--danger-rgb), 0.3); }
  .execution.submitted { border-color: rgba(var(--success-rgb), 0.3); }
  .top { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
  .top span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  h2 { margin: 3px 0 0; color: var(--text); font-size: 1rem; }
  .status { border: 1px solid rgba(var(--primary-rgb), 0.22); border-radius: 999px; background: rgba(var(--primary-rgb), 0.07); color: var(--primary); padding: 4px 8px; font-size: 0.62rem; font-weight: 800; text-transform: uppercase; }
  .facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .facts div { border: 1px solid var(--border); border-radius: 7px; padding: 9px; background: rgba(var(--primary-rgb), 0.03); min-width: 0; }
  .facts span { color: var(--muted); display: block; font-size: 0.62rem; font-weight: 800; text-transform: uppercase; }
  .facts strong { display: block; margin-top: 4px; color: var(--text); font-size: 0.78rem; overflow-wrap: anywhere; }
  .foot { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .danger { border-color: rgba(var(--danger-rgb), 0.26); color: var(--danger); }
  @media (max-width: 760px) { .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
