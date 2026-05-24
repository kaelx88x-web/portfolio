<script lang="ts">
  import type { OrderReconciliationLog } from '$lib/services/order-tracking.service';

  export let log: OrderReconciliationLog;
</script>

<article class="recon" class:mismatch={log.reconciliationStatus === 'mismatch'}>
  <span>{log.reconciliationType.replaceAll('_', ' ')} / {log.reconciliationStatus}</span>
  <h2>{log.actionRequired ? 'Action required' : 'No action required'}</h2>
  <p>{log.message}</p>
  <small>{new Date(log.createdAt).toLocaleString()}</small>
</article>

<style>
  .recon { border: 1px solid rgba(var(--success-rgb), 0.24); border-radius: 8px; background: var(--card); padding: 12px; display: grid; gap: 5px; }
  .recon.mismatch { border-color: rgba(var(--danger-rgb), 0.3); }
  span { color: var(--muted); font-size: 0.63rem; font-weight: 800; text-transform: uppercase; }
  h2 { margin: 0; color: var(--text); font-size: 0.82rem; }
  p, small { margin: 0; color: var(--muted); font-size: 0.72rem; line-height: 1.45; }
  small { font-size: 0.65rem; }
</style>
