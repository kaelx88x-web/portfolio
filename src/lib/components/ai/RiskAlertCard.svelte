<script lang="ts">
  import { AlertTriangle } from 'lucide-svelte';
  export let alert: any;
</script>

<article class="alert-card" class:critical={alert?.severity === 'critical'} class:high={alert?.severity === 'high'}>
  <div class="head">
    <AlertTriangle size={15} />
    <strong>{alert?.alert_type?.replaceAll('_', ' ') ?? 'risk alert'}</strong>
    <span>{alert?.severity ?? 'low'}</span>
  </div>
  <p>{alert?.message}</p>
</article>

<style>
  .alert-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 12px;
  }
  .alert-card.high, .alert-card.critical {
    border-color: rgba(var(--danger-rgb), 0.34);
    background: rgba(var(--danger-rgb), 0.07);
  }
  .head { display: flex; align-items: center; gap: 8px; color: var(--warning); }
  strong { flex: 1; color: var(--text); font-size: 0.78rem; text-transform: capitalize; }
  span { color: var(--muted); font-size: 0.64rem; font-weight: 800; text-transform: uppercase; }
  p { margin: 9px 0 0; color: var(--muted); font-size: 0.74rem; line-height: 1.45; }
</style>
