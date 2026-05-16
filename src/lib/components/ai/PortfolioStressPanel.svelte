<script lang="ts">
  export let scenarios: any[] = [];
</script>

<div class="stress">
  {#each scenarios as scenario}
    <article>
      <div class="top">
        <h3>{scenario.scenario}</h3>
        <strong>{scenario.estimatedImpactPct.toFixed(2)}%</strong>
      </div>
      <p>{scenario.explanation}</p>
      <span>{scenario.warning}</span>
    </article>
  {/each}
</div>

<style>
  .stress { display: grid; gap: 10px; }
  article { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 12px; }
  .top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  h3 { margin: 0; color: var(--text); font-size: .84rem; }
  strong { color: var(--danger); font-size: .9rem; }
  p { margin: 8px 0; color: var(--muted); font-size: .74rem; line-height: 1.45; }
  span { color: var(--warning); font-size: .68rem; line-height: 1.4; }
</style>
