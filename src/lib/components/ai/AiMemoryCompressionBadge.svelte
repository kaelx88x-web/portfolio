<script lang="ts">
  export let raw = 0;
  export let compressed = 0;
  $: ratio = raw > 0 ? Math.max(0, (1 - compressed / raw) * 100) : 0;
</script>

<span class="memory-compression">{ratio.toFixed(1)}% smaller</span>

<style>
  .memory-compression {
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
</style>
