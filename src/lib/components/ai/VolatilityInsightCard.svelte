<script lang="ts">
  import { Activity } from 'lucide-svelte';
  export let response: any;
</script>

<article class="card">
  <div class="head"><Activity size={16} /><h2>{response?.title ?? 'Volatility'}</h2></div>
  <p>{response?.summary}</p>
  <ul>{#each response?.main_risk_drivers ?? [] as item}<li>{item}</li>{/each}</ul>
</article>

<style>
  .card { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  .head { display: flex; align-items: center; gap: 8px; color: var(--primary); margin-bottom: 10px; }
  h2 { margin: 0; color: var(--text); font-size: .9rem; }
  p, li { color: var(--muted); font-size: .76rem; line-height: 1.5; }
  ul { display: grid; gap: 6px; margin: 10px 0 0; padding-left: 16px; }
</style>
