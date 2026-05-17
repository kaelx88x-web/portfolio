<!-- src/lib/components/optimization/GuardrailBanner.svelte -->
<script lang="ts">
  import type { GuardrailReport } from '$lib/services/guardrail.service';

  export let guardrail: GuardrailReport | null = null;

  $: breaches = guardrail?.violations.filter((v) => v.severity === 'breach') ?? [];
  $: warnings = guardrail?.violations.filter((v) => v.severity === 'warning') ?? [];
  $: show = !!guardrail && guardrail.violations.length > 0;
  $: isBreached = breaches.length > 0;
  $: title = isBreached
    ? `${breaches.length} Risk Control Breach${breaches.length > 1 ? 'es' : ''}`
    : `${warnings.length} Risk Control Warning${warnings.length > 1 ? 's' : ''}`;
</script>

{#if show}
  <div class="banner" class:breach={isBreached}>
    <span class="icon">{isBreached ? '🚨' : '⚠️'}</span>
    <div class="text">
      <strong>{title}</strong>
      <span>{guardrail?.summary}</span>
    </div>
    <a href="/optimization/allocation" class="link">View Details →</a>
  </div>
{/if}

<style>
  .banner { display: flex; align-items: center; gap: 12px; border: 1px solid rgba(245, 158, 11, 0.3); border-left: 3px solid #f59e0b; border-radius: 10px; background: rgba(245, 158, 11, 0.06); padding: 12px 14px; margin-bottom: 16px; }
  .banner.breach { border-color: rgba(239, 68, 68, 0.3); border-left-color: #ef4444; background: rgba(239, 68, 68, 0.06); }
  .icon { font-size: 1.1rem; flex-shrink: 0; }
  .text { flex: 1; display: grid; gap: 2px; }
  .text strong { font-size: 0.78rem; color: var(--text); }
  .text span { font-size: 0.68rem; color: var(--muted); }
  .link { font-size: 0.72rem; color: var(--primary); text-decoration: none; flex-shrink: 0; font-weight: 700; white-space: nowrap; }
</style>
