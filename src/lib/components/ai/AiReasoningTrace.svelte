<script lang="ts">
  export let trace: string[] = [];
</script>

<ol class="trace">
  {#each trace as item}
    <li>{item}</li>
  {:else}
    <li>No reasoning trace yet.</li>
  {/each}
</ol>

<style>
  .trace {
    display: grid;
    gap: 8px;
    margin: 0;
    padding-left: 18px;
    color: var(--text);
    font-size: 0.76rem;
    line-height: 1.5;
  }

  .trace li::marker {
    color: var(--primary);
    font-weight: 800;
  }
</style>
