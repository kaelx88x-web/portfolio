<script lang="ts">
  import { Lightbulb } from 'lucide-svelte';
  import type { AllocationSuggestion } from '$lib/services/smart-allocation.service';

  export let suggestion: AllocationSuggestion;

  const priorityColor = (p: string) =>
    p === 'high' ? 'var(--danger)' : p === 'medium' ? 'var(--warning)' : 'var(--muted)';
</script>

<article class="card" style="--pc:{priorityColor(suggestion.priority)}">
  <div class="head">
    <div class="icon"><Lightbulb size={14} /></div>
    <h2>{suggestion.title}</h2>
    <span class="badge">{suggestion.priority}</span>
  </div>
  <p class="summary">{suggestion.summary}</p>
  <p class="impact">{suggestion.impact_estimate}</p>
</article>

<style>
  .card {
    border: 1px solid var(--border);
    border-left: 3px solid var(--pc);
    border-radius: 8px;
    background: var(--card);
    padding: 12px 14px;
    display: grid;
    gap: 7px;
  }
  .head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; }
  .icon { color: var(--pc); display: flex; align-items: center; }
  h2 { margin: 0; color: var(--text); font-size: 0.82rem; font-weight: 600; }
  .badge {
    font-size: 0.58rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 3px 8px; border-radius: 999px;
    background: rgba(from var(--pc) r g b / 0.1);
    color: var(--pc);
    border: 1px solid rgba(from var(--pc) r g b / 0.25);
    white-space: nowrap;
  }
  .summary { margin: 0; color: var(--muted); font-size: 0.74rem; line-height: 1.5; }
  .impact { margin: 0; color: var(--text); font-size: 0.7rem; line-height: 1.45; opacity: 0.7; }
</style>
