<script lang="ts">
  import type { TradeTicketAuditLog } from '$lib/services/trade-layer.service';

  export let logs: TradeTicketAuditLog[] = [];
</script>

<section class="timeline">
  <h2>Audit Timeline</h2>
  {#if logs.length === 0}
    <p>No audit events yet.</p>
  {:else}
    {#each logs as log}
      <article>
        <span>{log.eventType}</span>
        <strong>{log.previousStatus ?? 'none'} -> {log.newStatus ?? 'none'}</strong>
        <p>{log.message}</p>
        <small>{new Date(log.createdAt).toLocaleString()}</small>
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
