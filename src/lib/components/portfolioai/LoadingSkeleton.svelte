<script lang="ts">
  export let variant: 'lines' | 'card' | 'table' = 'lines';
  export let rows = 3;
</script>

{#if variant === 'card'}
  <div class="skeleton-card">
    <div class="skel" style="width:40%;height:10px;margin-bottom:8px"></div>
    <div class="skel" style="width:60%;height:20px;margin-bottom:6px"></div>
    <div class="skel" style="width:30%;height:8px"></div>
  </div>
{:else if variant === 'table'}
  {#each Array(rows) as _}
    <div class="skel" style="width:100%;height:36px;margin-bottom:2px;border-radius:4px"></div>
  {/each}
{:else}
  {#each Array(rows) as _, i}
    <div class="skel" style="width:{90 - i * 15}%;height:8px;margin-bottom:8px"></div>
  {/each}
{/if}

<style>
  .skeleton-card {
    padding: 16px; border-radius: 10px;
    border: 1px solid #1a2038; background: #0f1523;
  }
  .skel {
    border-radius: 4px; background: #1a2038;
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
</style>
