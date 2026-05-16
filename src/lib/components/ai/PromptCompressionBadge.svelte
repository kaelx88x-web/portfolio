<script lang="ts">
  export let compressed = true;
  export let ratio = 0;
</script>

<span class:off={!compressed} class="compression-badge">
  {compressed ? `compressed ${Math.max(0, ratio).toFixed(1)}%` : 'raw context'}
</span>

<style>
  .compression-badge {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    border-radius: 999px;
    border: 1px solid rgba(var(--success-rgb), 0.3);
    background: rgba(var(--success-rgb), 0.1);
    color: var(--success);
    font-size: 0.68rem;
    font-weight: 700;
  }

  .compression-badge.off {
    border-color: rgba(var(--primary-rgb), 0.15);
    background: rgba(var(--primary-rgb), 0.05);
    color: var(--muted);
  }
</style>
