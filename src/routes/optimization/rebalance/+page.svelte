<script lang="ts">
  import { enhance } from '$app/forms';
  import { onMount } from 'svelte';
  import { animate, stagger } from 'motion';
  import { Sparkles, RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AllocationComparisonChart from '$lib/components/optimization/AllocationComparisonChart.svelte';
  import RebalanceSuggestionCard from '$lib/components/optimization/RebalanceSuggestionCard.svelte';
  import RebalanceProjectionCard from '$lib/components/simulation/RebalanceProjectionCard.svelte';
  import BehavioralInfluenceCard from '$lib/components/optimization/BehavioralInfluenceCard.svelte';
  import ExecutionConfirmPanel from '$lib/components/execution/ExecutionConfirmPanel.svelte';
  import type { TradeTicket } from '$lib/services/trade-layer.service';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  let simulating = false;
  let aiLoading  = false;

  // Execution state
  let queueing = false;
  let panelTickets: TradeTicket[] | null = null;
  let panelSkipped: Array<{ label: string; reason: string }> = [];
  let panelTicketIds = '';
  let executionLoading = false;
  let executionResults: Array<{ ticketId: string; status: string; message: string; brokerOrderId?: string | null }> | null = null;

  // Watch form for queueRebalance result
  $: if (form?.status === 'queued' && form?.tickets) {
    panelTickets = form.tickets as TradeTicket[];
    panelSkipped = (form.skipped as Array<{ label: string; reason: string }>) ?? [];
    panelTicketIds = (form.ticketIds as string) ?? '';
    executionResults = null;
    queueing = false;
  }

  // Watch form for executeAll result
  $: if (form?.status === 'execution_done') {
    executionResults = form.results as Array<{ ticketId: string; status: string; message: string; brokerOrderId?: string | null }>;
    executionLoading = false;
  }

  function queueEnhance() {
    return async ({ update }: { update: (opts?: { reset: boolean }) => Promise<void> }) => {
      await update({ reset: false });
      queueing = false;
    };
  }

  function executeEnhance() {
    return async ({ update }: { update: (opts?: { reset: boolean }) => Promise<void> }) => {
      await update({ reset: false });
      executionLoading = false;
    };
  }

  function cancelPanel() {
    panelTickets = null;
    panelSkipped = [];
    panelTicketIds = '';
    executionResults = null;
    executionLoading = false;
  }

  $: aiSuggestions    = (form?.status === 'ai_completed' && form?.suggestions) ? form.suggestions : null;
  $: displaySuggestions = aiSuggestions ?? data.rebalance;
  $: aiUsed           = form?.aiUsed === true;
  $: riskReduction    = data.rebalanceProjection?.riskReduction ?? 0;
  $: needsAction      = data.rebalance.length > 0;

  function simulateEnhance() {
    return async ({ update }: { update: (opts?: { reset: boolean }) => Promise<void> }) => {
      await update({ reset: false });
      simulating = false;
    };
  }

  function aiEnhance() {
    return async ({ update }: { update: (opts?: { reset: boolean }) => Promise<void> }) => {
      await update({ reset: false });
      aiLoading = false;
    };
  }

  onMount(() => {
    (animate as unknown as (
      selector: string,
      keyframes: Record<string, unknown>,
      options: Record<string, unknown>
    ) => void)(
      '.suggestion-anim',
      { opacity: [0, 1], y: [14, 0] },
      { delay: stagger(0.07), duration: 0.32, easing: 'ease-out' }
    );
  });
</script>

<PageHeader
  title="Rebalance Suggestions"
  subtitle="What to buy, reduce, or add to move your portfolio toward the target allocation."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Rebalance' }]}
/>

<!-- ── Control Bar ──────────────────────────────────────────────────── -->
<div class="control-bar">
  <!-- Left: status chips -->
  <div class="chips">
    <div class="chip" class:chip-amber={needsAction} class:chip-green={!needsAction}>
      {#if needsAction}
        <AlertTriangle size={11} />
        {data.rebalance.length} action{data.rebalance.length !== 1 ? 's' : ''} needed
      {:else}
        <CheckCircle2 size={11} />
        Portfolio up to date
      {/if}
    </div>
    {#if data.rebalanceProjection}
      <div class="chip" class:chip-green={riskReduction > 0} class:chip-amber={riskReduction <= 0}>
        <TrendingUp size={11} />
        Risk {riskReduction > 0 ? '−' : '+'}{Math.abs(riskReduction).toFixed(1)} pts
      </div>
    {/if}
    {#if aiUsed}
      <div class="chip chip-ai"><Sparkles size={11} /> AI active</div>
    {/if}
  </div>

  <!-- Right: action buttons -->
  <div class="actions">
    <form method="POST" action="?/simulate" use:enhance={simulateEnhance} on:submit={() => (simulating = true)}>
      <input type="hidden" name="portfolioMode" value={data.portfolioMode} />
      <button class="btn-outline" type="submit" disabled={simulating}>
        {#if simulating}<span class="spin"></span>{:else}<RefreshCw size={12} />{/if}
        {simulating ? 'Simulating…' : 'Simulate'}
      </button>
    </form>

    <form method="POST" action="?/aiSuggest" use:enhance={aiEnhance} on:submit={() => (aiLoading = true)}>
      <input type="hidden" name="portfolioMode" value={data.portfolioMode} />
      <button class="btn-ai" type="submit" disabled={aiLoading}>
        {#if aiLoading}<span class="spin spin-ai"></span>{:else}<Sparkles size={12} />{/if}
        {aiLoading ? 'Asking AI…' : 'AI Suggest'}
      </button>
    </form>

    <form method="POST" action="?/queueRebalance" use:enhance={queueEnhance} on:submit={() => (queueing = true)}>
      <input type="hidden" name="portfolioMode" value={data.portfolioMode} />
      <button class="btn-execute" type="submit" disabled={queueing || !displaySuggestions?.length}>
        {#if queueing}<span class="spin spin-exec"></span>{:else}⚡{/if}
        {queueing ? 'Queuing…' : 'Execute All'}
      </button>
    </form>
  </div>
</div>

{#if form?.message}
  <div class="notice" class:notice-ai={aiUsed}>
    {#if aiUsed}<Sparkles size={13} />{/if}
    {form.message}
  </div>
{/if}

{#if panelTickets !== null}
  <form id="execute-all-form" method="POST" action="?/executeAll" use:enhance={executeEnhance} on:submit={() => (executionLoading = true)}>
    <input type="hidden" name="ticketIds" value={panelTicketIds} />
  </form>

  <ExecutionConfirmPanel
    tickets={panelTickets}
    skipped={panelSkipped}
    mode="rebalance"
    loading={executionLoading}
    results={executionResults}
    on:confirm={() => {
      executionLoading = true;
      (document.getElementById('execute-all-form') as HTMLFormElement)?.requestSubmit();
    }}
    on:cancel={cancelPanel}
    on:retry={() => {
      queueing = true;
      (document.querySelector('form[action="?/queueRebalance"]') as HTMLFormElement)?.requestSubmit();
    }}
  />
{/if}

{#if data.behavioralProfile}
  <BehavioralInfluenceCard
    profile={data.behavioralProfile}
    explanation={data.behavioralExplanation}
  />
{/if}

<!-- ── Main Layout ─────────────────────────────────────────────────── -->
<div class="layout">
  <main class="list">
    {#each displaySuggestions as suggestion}
      <div class="suggestion-anim">
        <RebalanceSuggestionCard {suggestion} />
      </div>
    {/each}

    {#if displaySuggestions.length === 0}
      <div class="empty">
        <CheckCircle2 size={30} strokeWidth={1.5} />
        <strong>No rebalance actions needed</strong>
        <span>Your portfolio allocation matches the target. Check back after your next sync or run a new optimization.</span>
      </div>
    {/if}

    <a class="cta-card" href="/optimization/projection">
      <div>
        <strong>View Portfolio Projection</strong>
        <span>See how this rebalance affects portfolio value over 1–5 years</span>
      </div>
      <ArrowRight size={16} class="cta-arrow" />
    </a>
  </main>

  <aside>
    {#if data.rebalanceProjection}
      <RebalanceProjectionCard projection={data.rebalanceProjection} />
    {/if}
    {#if data.rebalance[0]}
      <AllocationComparisonChart allocation={data.rebalance[0].targetAllocation} />
    {/if}
  </aside>
</div>

<style>
  /* ── Control bar ──────────────────────────────────────────────────── */
  .control-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.68rem;
    font-weight: 700;
    padding: 5px 11px;
    border-radius: 999px;
    border: 1px solid var(--border);
    color: var(--muted);
    background: var(--card);
  }
  .chip-amber { border-color: rgba(var(--warning-rgb),.4); color: var(--warning); background: rgba(var(--warning-rgb),.07); }
  .chip-green { border-color: rgba(var(--success-rgb),.4); color: var(--success); background: rgba(var(--success-rgb),.07); }
  .chip-ai    { border-color: rgba(var(--primary-rgb),.4); color: var(--primary); background: rgba(var(--primary-rgb),.07); }

  /* Mode tabs + buttons */
  .actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.btn-outline {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 13px; border-radius: 7px; white-space: nowrap;
    font-size: 0.71rem; font-weight: 700;
    color: var(--text); background: var(--card);
    border: 1px solid var(--border); cursor: pointer;
    transition: border-color 0.12s, color 0.12s;
  }
  .btn-outline:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
  .btn-outline:disabled { opacity: 0.6; cursor: not-allowed; }

  .btn-ai {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 13px; border-radius: 7px; white-space: nowrap;
    font-size: 0.71rem; font-weight: 700;
    color: var(--primary); background: rgba(var(--primary-rgb),.1);
    border: 1px solid rgba(var(--primary-rgb),.35); cursor: pointer;
    transition: background 0.12s;
  }
  .btn-ai:hover:not(:disabled) { background: rgba(var(--primary-rgb),.18); }
  .btn-ai:disabled { opacity: 0.6; cursor: not-allowed; }

  /* ── Notice ───────────────────────────────────────────────────────── */
  .notice {
    display: flex; align-items: center; gap: 7px;
    margin-bottom: 14px;
    border: 1px solid rgba(var(--success-rgb),.3);
    border-radius: 8px; background: rgba(var(--success-rgb),.07);
    color: var(--success); padding: 10px 14px; font-size: 0.76rem;
  }
  .notice-ai { border-color: rgba(var(--primary-rgb),.3); background: rgba(var(--primary-rgb),.07); color: var(--primary); }

  /* ── Layout ───────────────────────────────────────────────────────── */
  .layout { display: grid; grid-template-columns: minmax(0,1fr) 22rem; gap: 14px; }
  .list   { display: grid; gap: 10px; align-content: start; }
  aside   { display: grid; align-content: start; gap: 12px; }

  /* ── Suggestion anim wrapper ──────────────────────────────────────── */
  .suggestion-anim { opacity: 0; }

  /* ── Empty state ──────────────────────────────────────────────────── */
  .empty {
    display: grid; justify-items: center; gap: 8px;
    padding: 40px 20px;
    border: 1px dashed var(--border); border-radius: 10px;
    color: var(--muted); text-align: center;
  }
  .empty strong { color: var(--text); font-size: 0.86rem; }
  .empty span   { font-size: 0.73rem; max-width: 300px; line-height: 1.55; }

  /* ── CTA card ─────────────────────────────────────────────────────── */
  .cta-card {
    display: flex; align-items: center; justify-content: space-between; gap: 14px;
    padding: 14px 18px;
    border: 1px solid rgba(var(--primary-rgb),.2); border-radius: 10px;
    background: rgba(var(--primary-rgb),.04); text-decoration: none;
    transition: background 0.13s, border-color 0.13s;
  }
  .cta-card:hover { background: rgba(var(--primary-rgb),.09); border-color: rgba(var(--primary-rgb),.4); }
  .cta-card div { display: grid; gap: 3px; }
  .cta-card strong { font-size: 0.82rem; color: var(--text); }
  .cta-card span   { font-size: 0.7rem;  color: var(--muted); }
  :global(.cta-arrow) { flex-shrink: 0; color: var(--primary); opacity: 0.7; }

  /* ── Spinner ──────────────────────────────────────────────────────── */
  .spin { display:inline-block; width:12px; height:12px; border-radius:50%; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; animation:spin .7s linear infinite; }
  .spin-ai { border-color:rgba(var(--primary-rgb),.3); border-top-color:var(--primary); }
  .spin-exec { border-color:rgba(var(--primary-rgb),.3); border-top-color:var(--primary); }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Execute All button ───────────────────────────────────────────── */
  .btn-execute { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; background: rgba(var(--primary-rgb), 0.1); color: var(--primary); border: 1px solid rgba(var(--primary-rgb), 0.35); cursor: pointer; transition: all 0.12s; }
  .btn-execute:hover:not(:disabled) { background: rgba(var(--primary-rgb), 0.18); }
  .btn-execute:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Responsive ───────────────────────────────────────────────────── */
  @media (max-width: 1050px) { .layout { grid-template-columns: 1fr; } }
  @media (max-width: 700px)  {
    .control-bar { flex-direction: column; align-items: flex-start; }
    .actions { width: 100%; flex-wrap: wrap; }
  }
</style>
