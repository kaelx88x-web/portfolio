<script lang="ts">
  export let mode = 'hybrid';
</script>

<span class="badge" class:stock={mode === 'stock'} class:options={mode === 'options'} class:hybrid={mode === 'hybrid'}>
  {mode.replace('_', ' ')}
</span>

<style>
  .badge { display: inline-flex; align-items: center; border-radius: 999px; border: 1px solid var(--border); padding: 3px 8px; color: var(--muted); background: var(--surface-1); font-size: 0.62rem; font-weight: 800; text-transform: uppercase; }
  .stock { color: var(--primary); border-color: rgba(var(--primary-rgb), 0.25); background: rgba(var(--primary-rgb), 0.08); }
  .options { color: var(--warning); border-color: rgba(var(--warning-rgb), 0.28); background: rgba(var(--warning-rgb), 0.1); }
  .hybrid { color: var(--success); border-color: rgba(var(--success-rgb), 0.25); background: rgba(var(--success-rgb), 0.08); }
</style>
