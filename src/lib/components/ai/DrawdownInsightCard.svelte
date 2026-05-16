<script lang="ts">
  import { TrendingDown } from 'lucide-svelte';
  export let response: any;
</script>

<article class="card">
  <div class="head"><TrendingDown size={16} /><h2>{response?.title ?? 'Drawdown'}</h2></div>
  <p>{response?.summary}</p>
  <div class="warnings">
    {#each response?.warnings ?? [] as warning}<span>{warning}</span>{/each}
  </div>
</article>

<style>
  .card { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  .head { display: flex; align-items: center; gap: 8px; color: var(--warning); margin-bottom: 10px; }
  h2 { margin: 0; color: var(--text); font-size: .9rem; }
  p { color: var(--muted); font-size: .76rem; line-height: 1.5; }
  .warnings { display: grid; gap: 7px; margin-top: 10px; }
  span { border: 1px solid var(--border); border-radius: 8px; padding: 8px; color: var(--muted); font-size: .72rem; line-height: 1.4; }
</style>
