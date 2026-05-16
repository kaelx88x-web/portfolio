<script lang="ts">
  export let intent = 'general_question';
</script>

<span class="intent-badge">{intent.replaceAll('_', ' ')}</span>

<style>
  .intent-badge {
    display: inline-flex;
    align-items: center;
    min-height: 22px;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid rgba(var(--primary-rgb), 0.32);
    background: rgba(var(--primary-rgb), 0.12);
    color: var(--primary);
    font-size: 0.68rem;
    font-weight: 800;
    text-transform: capitalize;
  }
</style>
