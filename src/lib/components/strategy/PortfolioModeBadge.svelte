<script lang="ts">
  export let mode = 'balanced';

  $: label = mode.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
</script>

<span class="badge" class:hot={mode.includes('aggressive')} class:calm={mode.includes('defensive')}>
  {label}
</span>

<style>
  .badge { display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(var(--primary-rgb), 0.28); border-radius: 999px; background: rgba(var(--primary-rgb), 0.08); color: var(--primary); padding: 4px 9px; font-size: 0.68rem; font-weight: 800; white-space: nowrap; }
  .badge.hot { border-color: rgba(var(--warning-rgb), 0.32); background: rgba(var(--warning-rgb), 0.08); color: var(--warning); }
  .badge.calm { border-color: rgba(var(--success-rgb), 0.32); background: rgba(var(--success-rgb), 0.08); color: var(--success); }
</style>
