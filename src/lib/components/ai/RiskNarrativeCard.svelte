<script lang="ts">
  import { ShieldCheck } from 'lucide-svelte';
  import AiConfidenceBadge from './AiConfidenceBadge.svelte';
  export let narrative: any;
  export let response: any;
</script>

<article class="narrative">
  <div class="head">
    <div class="label"><ShieldCheck size={16} /> Risk Narrative</div>
    <AiConfidenceBadge confidence={response?.confidence ?? 'medium'} />
  </div>
  <h2>{response?.title ?? 'Risk Advisor'}</h2>
  <p class="summary">{narrative?.summary ?? response?.summary}</p>
  <p>{narrative?.narrative}</p>
</article>

<style>
  .narrative { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 16px; }
  .head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
  .label { display: flex; align-items: center; gap: 8px; color: var(--primary); font-size: 0.7rem; font-weight: 800; text-transform: uppercase; }
  h2 { margin: 0 0 8px; color: var(--text); font-size: 1rem; }
  p { margin: 0; color: var(--muted); font-size: 0.78rem; line-height: 1.55; }
  .summary { color: var(--text); font-weight: 700; margin-bottom: 8px; }
</style>
