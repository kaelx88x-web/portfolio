<script lang="ts">
  export let provider = 'gemini';
</script>

<span class="provider-badge">{provider}</span>

<style>
  .provider-badge {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    border-radius: 999px;
    border: 1px solid rgba(var(--primary-rgb), 0.3);
    background: rgba(var(--primary-rgb), 0.1);
    color: var(--primary);
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
  }
</style>
