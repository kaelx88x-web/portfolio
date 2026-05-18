<script lang="ts">
  export let level = 'low';
  export let value = 0;
</script>

<span class="badge" class:medium={level === 'medium'} class:high={level === 'high'}>
  {value.toFixed(2)}% options
</span>

<style>
  .badge { display: inline-flex; border: 1px solid rgba(var(--success-rgb), .25); border-radius: 999px; background: rgba(var(--success-rgb), .08); color: var(--success); padding: 3px 9px; font-size: .62rem; font-weight: 800; text-transform: uppercase; }
  .medium { border-color: rgba(var(--warning-rgb), .28); background: rgba(var(--warning-rgb), .1); color: var(--warning); }
  .high { border-color: rgba(var(--danger-rgb), .28); background: rgba(var(--danger-rgb), .1); color: var(--danger); }
</style>
