<script lang="ts">
  import { AlertTriangle } from 'lucide-svelte';
  import type { StrategyConflict } from '$lib/services/strategy-orchestrator.service';

  export let conflict: StrategyConflict;
</script>

<article class="conflict" class:high={conflict.severity === 'high'} class:medium={conflict.severity === 'medium'}>
  <div class="head">
    <AlertTriangle size={16} />
    <span>{conflict.severity}</span>
  </div>
  <h2>{conflict.conflictType.replaceAll('_', ' ')}</h2>
  <p>{conflict.description}</p>
  <div>{conflict.resolutionSuggestion}</div>
</article>

<style>
  .conflict { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 8px; }
  .conflict.medium { border-color: rgba(var(--warning-rgb), 0.32); }
  .conflict.high { border-color: rgba(var(--danger-rgb), 0.32); }
  .head { display: flex; justify-content: space-between; gap: 10px; color: var(--success); }
  .medium .head { color: var(--warning); }
  .high .head { color: var(--danger); }
  .head span { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  h2 { margin: 0; color: var(--text); font-size: 0.9rem; text-transform: capitalize; }
  p, div { margin: 0; color: var(--muted); font-size: 0.74rem; line-height: 1.5; }
  div { border-top: 1px solid var(--border); padding-top: 8px; }
</style>
