<script lang="ts">
  import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-svelte';
  import type { BrokerExecutionRequest } from '$lib/services/moomoo-execution.service';

  export let execution: BrokerExecutionRequest;
</script>

<section class="safety" class:blocked={execution.safety.blocked}>
  <div class="head">
    {#if execution.safety.blocked}<XCircle size={16} />{:else if execution.safety.warnings}<AlertTriangle size={16} />{:else}<CheckCircle2 size={16} />{/if}
    <div>
      <span>{execution.safety.blocked ? 'Blocked' : execution.safety.warnings ? 'Warnings' : 'Passed'}</span>
      <p>{execution.safety.summary}</p>
    </div>
  </div>
  <div class="checks">
    {#each execution.safetyChecks ?? execution.safety.checks as check}
      <article class={check.checkStatus}>
        <strong>{check.checkType.replaceAll('_', ' ')}</strong>
        <span>{check.message}</span>
      </article>
    {/each}
  </div>
</section>

<style>
  .safety { border: 1px solid rgba(var(--success-rgb), 0.26); border-radius: 8px; background: rgba(var(--success-rgb), 0.05); padding: 12px; display: grid; gap: 10px; }
  .safety.blocked { border-color: rgba(var(--danger-rgb), 0.28); background: rgba(var(--danger-rgb), 0.05); }
  .head { display: flex; gap: 9px; align-items: start; color: var(--success); }
  .blocked .head { color: var(--danger); }
  .head span { display: block; color: var(--text); font-size: 0.68rem; font-weight: 800; text-transform: uppercase; }
  .head p { margin: 3px 0 0; color: var(--muted); font-size: 0.75rem; line-height: 1.45; }
  .checks { display: grid; gap: 7px; }
  article { border: 1px solid var(--border); border-radius: 7px; background: var(--card); padding: 9px; display: grid; gap: 3px; }
  article.block { border-color: rgba(var(--danger-rgb), 0.28); }
  article.warning { border-color: rgba(var(--warning-rgb), 0.28); }
  strong { color: var(--text); font-size: 0.72rem; text-transform: uppercase; }
  span { color: var(--muted); font-size: 0.72rem; line-height: 1.4; }
</style>
