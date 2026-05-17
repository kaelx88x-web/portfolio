<!-- src/lib/components/optimization/OptimizationStatStrip.svelte -->
<script lang="ts">
  export let stats: Array<{
    label: string;
    value: string;
    sub?: string;
    color?: 'green' | 'amber' | 'red';
  }> = [];
</script>

<div class="strip">
  {#each stats as stat}
    <div class="card" class:green={stat.color === 'green'} class:amber={stat.color === 'amber'} class:red={stat.color === 'red'}>
      <span class="label">{stat.label}</span>
      <strong class="value">{stat.value}</strong>
      {#if stat.sub}<span class="sub">{stat.sub}</span>{/if}
    </div>
  {/each}
</div>

<style>
  .strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 16px; }
  .card { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 12px 14px; display: grid; gap: 3px; }
  .label { color: var(--muted); font-size: 0.62rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
  .value { color: var(--text); font-size: 1.05rem; font-weight: 800; }
  .sub { color: var(--muted); font-size: 0.65rem; }
  .green .value { color: var(--success); }
  .amber .value { color: var(--warning); }
  .red .value { color: var(--danger); }
</style>
