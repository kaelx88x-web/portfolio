<script lang="ts">
  import type { BrokerOrderEvent } from '$lib/services/order-tracking.service';

  export let events: BrokerOrderEvent[] = [];
</script>

<section class="timeline">
  <h2>Order Timeline</h2>
  {#if events.length === 0}
    <p>No order events yet.</p>
  {:else}
    {#each events as event}
      <article>
        <span>{event.eventType.replaceAll('_', ' ')}</span>
        <strong>{event.previousStatus ?? 'none'} -> {event.newStatus ?? 'none'}</strong>
        <p>{event.message}</p>
        <small>{new Date(event.occurredAt).toLocaleString()}</small>
      </article>
    {/each}
  {/if}
</section>

<style>
  .timeline { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 10px; }
  h2 { margin: 0; color: var(--text); font-size: 0.95rem; }
  article { border-left: 2px solid rgba(var(--primary-rgb), 0.35); padding-left: 10px; display: grid; gap: 3px; }
  span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  strong { color: var(--text); font-size: 0.76rem; }
  p, small { margin: 0; color: var(--muted); font-size: 0.72rem; line-height: 1.45; }
  small { font-size: 0.65rem; }
</style>
