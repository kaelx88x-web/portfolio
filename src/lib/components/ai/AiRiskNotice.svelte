<script lang="ts">
  import { ShieldAlert } from 'lucide-svelte';

  export let risks: string[] = [];
  export let mode = 'read_only_real';
</script>

<article class="risk-notice">
  <div class="head">
    <ShieldAlert size={16} />
    <h2>{mode === 'sandbox_paper' ? 'Sandbox Risk Notice' : 'Read-Only Risk Notice'}</h2>
  </div>
  <ul>
    {#each risks as risk}
      <li>{risk}</li>
    {:else}
      <li>No generated risk flag is present in the current context.</li>
    {/each}
  </ul>
</article>

<style>
  .risk-notice {
    border: 1px solid rgba(var(--warning-rgb), 0.32);
    border-radius: 8px;
    background: rgba(var(--warning-rgb), 0.08);
    padding: 14px;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    color: var(--warning);
  }

  h2 {
    margin: 0;
    color: var(--text);
    font-size: 0.86rem;
  }

  ul {
    display: grid;
    gap: 7px;
    margin: 0;
    padding-left: 16px;
    color: var(--muted);
    font-size: 0.75rem;
    line-height: 1.5;
  }
</style>
