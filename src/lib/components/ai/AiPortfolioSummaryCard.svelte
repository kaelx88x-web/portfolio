<script lang="ts">
  import { Activity, Database, PieChart } from 'lucide-svelte';
  import { money, percent } from '$lib/format';

  export let context: any;

  $: healthLabel = context?.risk?.healthLabel?.replace('_', ' ') ?? 'unknown';
</script>

<div class="card ctx-card">
  <div class="ctx-header">
    <div>
      <div class="ctx-title">Portfolio Context</div>
      <div class="ctx-hash">{context?.metadata?.contextHash ?? '—'}</div>
    </div>
    <span class="health-badge">{healthLabel}</span>
  </div>

  <div class="ctx-stats">
    <div class="ctx-stat">
      <div class="ctx-stat-label"><Activity size={13} /> Value</div>
      <div class="ctx-stat-val">{money(context?.portfolio?.value ?? 0, context?.metadata?.baseCurrency ?? 'USD')}</div>
    </div>
    <div class="ctx-stat">
      <div class="ctx-stat-label"><PieChart size={13} /> Cash</div>
      <div class="ctx-stat-val">{percent(context?.portfolio?.cashRatio ?? 0)}</div>
    </div>
    <div class="ctx-stat">
      <div class="ctx-stat-label"><Database size={13} /> Snapshots</div>
      <div class="ctx-stat-val">{context?.metadata?.snapshotCount ?? 0}</div>
    </div>
  </div>
</div>

<style>
  .ctx-card    { padding: 18px; }
  .ctx-header  { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
  .ctx-title   { font-size: 0.85rem; font-weight: 700; color: var(--text); }
  .ctx-hash    { font-size: 0.62rem; color: var(--muted); margin-top: 3px; font-family: monospace; }

  .health-badge { font-size: 0.6rem; font-weight: 700; text-transform: capitalize; padding: 3px 8px;
                  border-radius: 20px; background: rgba(var(--primary-rgb),0.12); border: 1px solid rgba(var(--primary-rgb),0.25); color: var(--primary); white-space: nowrap; }

  .ctx-stats    { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .ctx-stat     { background: var(--ai-bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; }
  .ctx-stat-label { display: flex; align-items: center; gap: 5px; font-size: 0.6rem; font-weight: 600;
                    text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 6px; }
  .ctx-stat-val   { font-size: 0.9rem; font-weight: 700; color: var(--text); }
</style>
