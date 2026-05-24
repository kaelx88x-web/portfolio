<script lang="ts">
  import { AlertTriangle, CheckCircle2 } from 'lucide-svelte';
  import type { TradeTicketValidation } from '$lib/services/trade-layer.service';

  export let guardrail: TradeTicketValidation;
</script>

<section class="guardrail" class:passed={guardrail.passed}>
  <div class="head">
    {#if guardrail.passed}<CheckCircle2 size={16} />{:else}<AlertTriangle size={16} />{/if}
    <div>
      <span>{guardrail.passed ? 'Guardrail passed' : 'Guardrail review'}</span>
      <p>{guardrail.summary}</p>
    </div>
  </div>
  <div class="meta">
    <span>Risk: {guardrail.riskLevel}</span>
    <span>Est. ${guardrail.estimatedValue.toLocaleString()}</span>
    <span>Broker order: none</span>
  </div>
  {#if guardrail.violations.length}
    <div class="violations">
      {#each guardrail.violations as violation}
        <div class={violation.severity}>
          <strong>{violation.severity}</strong>
          <span>{violation.message}</span>
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .guardrail { border: 1px solid rgba(var(--warning-rgb), 0.28); border-radius: 8px; background: rgba(var(--warning-rgb), 0.06); padding: 12px; display: grid; gap: 10px; }
  .guardrail.passed { border-color: rgba(var(--success-rgb), 0.28); background: rgba(var(--success-rgb), 0.06); }
  .head { display: flex; gap: 9px; align-items: start; color: var(--warning); }
  .passed .head { color: var(--success); }
  .head span { display: block; color: var(--text); font-size: 0.75rem; font-weight: 800; text-transform: uppercase; }
  .head p { margin: 3px 0 0; color: var(--muted); font-size: 0.75rem; line-height: 1.45; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px; }
  .meta span, .violations div { border: 1px solid var(--border); border-radius: 6px; background: var(--card); color: var(--muted); padding: 5px 7px; font-size: 0.68rem; font-weight: 700; }
  .violations { display: grid; gap: 6px; }
  .violations div { display: grid; gap: 2px; padding: 8px; }
  .violations strong { color: var(--warning); text-transform: uppercase; }
  .violations .breach strong { color: var(--danger); }
  .violations span { color: var(--text); font-weight: 500; line-height: 1.4; }
</style>
