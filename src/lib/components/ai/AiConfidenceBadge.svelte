<script lang="ts">
  export let confidence: 'low' | 'medium' | 'high' | string = 'medium';
</script>

<span class="confidence-badge" class:low={confidence === 'low'} class:high={confidence === 'high'}>
  {confidence}
</span>

<style>
  .confidence-badge {
    display: inline-flex;
    align-items: center;
    min-height: 22px;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid rgba(var(--warning-rgb), 0.3);
    background: rgba(var(--warning-rgb), 0.12);
    color: var(--warning);
    font-size: 0.68rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  .confidence-badge.high {
    border-color: rgba(var(--success-rgb), 0.3);
    background: rgba(var(--success-rgb), 0.12);
    color: var(--success);
  }

  .confidence-badge.low {
    border-color: rgba(var(--danger-rgb), 0.3);
    background: rgba(var(--danger-rgb), 0.12);
    color: var(--danger);
  }
</style>
