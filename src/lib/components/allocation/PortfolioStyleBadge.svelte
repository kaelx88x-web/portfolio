<script lang="ts">
  export let style = 'balanced';
</script>

<span class="badge" class:aggressive={style === 'aggressive' || style === 'high_volatility'} class:income={style === 'income_focused'} class:growth={style === 'growth'} class:defensive={style === 'defensive'}>
  {style.replace('_', ' ')}
</span>

<style>
  .badge { display: inline-flex; border-radius: 999px; border: 1px solid var(--border); background: var(--surface-1); color: var(--muted); padding: 3px 9px; font-size: 0.62rem; font-weight: 800; text-transform: uppercase; }
  .growth { color: var(--primary); background: rgba(var(--primary-rgb), 0.08); border-color: rgba(var(--primary-rgb), 0.25); }
  .income { color: var(--success); background: rgba(var(--success-rgb), 0.08); border-color: rgba(var(--success-rgb), 0.25); }
  .defensive { color: var(--warning); background: rgba(var(--warning-rgb), 0.1); border-color: rgba(var(--warning-rgb), 0.25); }
  .aggressive { color: var(--danger); background: rgba(var(--danger-rgb), 0.08); border-color: rgba(var(--danger-rgb), 0.25); }
</style>
