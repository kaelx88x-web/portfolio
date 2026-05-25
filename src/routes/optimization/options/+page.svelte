<script lang="ts">
  import { enhance } from '$app/forms';
  import { tick } from 'svelte';
  import { Coins, RefreshCw, ShieldAlert, Table2 } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AssignmentRiskCard from '$lib/components/options/AssignmentRiskCard.svelte';
  import CollateralUsageChart from '$lib/components/options/CollateralUsageChart.svelte';
  import CoveredCallTable from '$lib/components/options/CoveredCallTable.svelte';
  import ExecutionConfirmPanel from '$lib/components/execution/ExecutionConfirmPanel.svelte';
  import OptimizationStatStrip from '$lib/components/optimization/OptimizationStatStrip.svelte';
  import OptionsExposureCard from '$lib/components/options/OptionsExposureCard.svelte';
  import PremiumYieldCard from '$lib/components/options/PremiumYieldCard.svelte';
  import PutExposureChart from '$lib/components/options/PutExposureChart.svelte';
  import WheelStrategyCard from '$lib/components/options/WheelStrategyCard.svelte';
  import type { ActionData, PageData } from './$types';
  import type { TradeTicket } from '$lib/services/trade-layer.service';
  import type { CoveredCallCandidate } from '$lib/services/options-intelligence.service';
  import type { DTE } from '$lib/constants/dte';

  export let data: PageData;
  export let form: ActionData;

  type Color = 'red' | 'amber' | 'green';
  function statusColor(status: string): Color {
    return status === 'high' ? 'red' : status === 'medium' ? 'amber' : 'green';
  }
  $: stats = data.widgets.slice(0, 4).map((w) => ({ label: w.label, value: w.value, color: statusColor(w.status) }));

  type ActivePanel = {
    symbol: string;
    optionType: 'call' | 'put';
    prevTicketId: string | null;
    selectedDte: DTE;
  };

  let activePanel: ActivePanel | null = null;
  let panelTicket: TradeTicket | null = null;
  let executionLoading = false;
  let executionResult: { ticketId: string; status: string; message: string; brokerOrderId?: string | null } | null = null;

  $: if (form?.status === 'queued' && form?.ticket) {
    panelTicket = form.ticket as TradeTicket;
    executionResult = null;
    executionLoading = false;
    if (activePanel) activePanel = { ...activePanel, prevTicketId: (form.ticket as TradeTicket).id };
  }

  $: if (form?.status === 'executed') {
    executionLoading = false;
    executionResult = {
      ticketId: String(form.ticketId ?? ''),
      status: 'submitted',
      message: String(form.message ?? 'Submitted.'),
      brokerOrderId: (form.brokerOrderId as string | null) ?? null
    };
  }

  function openPanel(symbol: string, optionType: 'call' | 'put') {
    // Only carry forward prevTicketId if the ticket is still pending (not yet executed).
    // If executionResult is set the ticket is terminal — cancelling it would fail.
    const prevId = (panelTicket && !executionResult) ? panelTicket.id : null;
    activePanel = { symbol, optionType, prevTicketId: prevId, selectedDte: 30 };
    panelTicket = null;
    executionResult = null;
  }

  function closePanel() {
    activePanel = null;
    panelTicket = null;
    executionResult = null;
    executionLoading = false;
  }

  function handleCoveredCallExecute(e: CustomEvent<CoveredCallCandidate>) {
    openPanel(e.detail.symbol, 'call');
  }

  function handlePutExecute(symbol: string) {
    openPanel(symbol, 'put');
  }

  function queueOptionEnhance() {
    return async ({ update }: { update: (opts?: { reset: boolean }) => Promise<void> }) => {
      await update({ reset: false });
    };
  }

  function executeOptionEnhance() {
    return async ({ update }: { update: (opts?: { reset: boolean }) => Promise<void> }) => {
      await update({ reset: false });
      executionLoading = false;
    };
  }

  // Auto-queue when a NEW panel opens (symbol/type changed, not DTE change)
  let prevPanelKey = '';
  $: {
    if (activePanel) {
      const key = `${activePanel.symbol}-${activePanel.optionType}`;
      if (key !== prevPanelKey) {
        prevPanelKey = key;
        setTimeout(() => {
          (document.getElementById('queue-option-form') as HTMLFormElement)?.requestSubmit();
        }, 0);
      }
    } else {
      prevPanelKey = '';
    }
  }
</script>

<PageHeader
  title="Options Strategy"
  subtitle="Covered call and cash-secured put candidates, ranked by premium yield."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Options' }]}
/>

<div class="actions-bar">
  <div class="actions-left">
    <a class="tab-btn" href="/optimization/options/exposure"><ShieldAlert size={13} /> Exposure</a>
    <a class="tab-btn" href="/optimization/options/wheel"><Table2 size={13} /> Wheel</a>
    <a class="tab-btn" href="/optimization/options/premium"><Coins size={13} /> Premium</a>
  </div>
  <form method="POST" action="?/refresh">
    <button class="button" type="submit"><RefreshCw size={13} /> Refresh Data</button>
  </form>
</div>

<OptimizationStatStrip {stats} />

{#if form?.message}<div class="notice">{form.message}</div>{/if}

{#if activePanel}
  <form id="queue-option-form" method="POST" action="?/queueOption" use:enhance={queueOptionEnhance}>
    <input type="hidden" name="symbol" value={activePanel.symbol} />
    <input type="hidden" name="optionType" value={activePanel.optionType} />
    <input type="hidden" name="dte" value={activePanel.selectedDte} />
    <input type="hidden" name="prevTicketId" value={activePanel.prevTicketId ?? ''} />
  </form>
{/if}

{#if panelTicket}
  <form id="execute-option-form" method="POST" action="?/executeOption" use:enhance={executeOptionEnhance} on:submit={() => (executionLoading = true)}>
    <input type="hidden" name="ticketId" value={panelTicket.id} />
  </form>
{/if}

<div class="layout">
  <main class="main-col">
    <OptionsExposureCard exposure={data.exposure} />
    <CoveredCallTable
      rows={data.coveredCalls}
      executeEnabled={true}
      on:execute={handleCoveredCallExecute}
    />

    {#if activePanel?.optionType === 'call'}
      {#if !panelTicket}
        <div class="panel-loading">⚡ Queuing covered call ticket…</div>
      {:else}
        <ExecutionConfirmPanel
          tickets={[panelTicket]}
          mode="option"
          selectedDte={activePanel.selectedDte}
          loading={executionLoading}
          results={executionResult ? [executionResult] : null}
          on:confirm={() => {
            executionLoading = true;
            (document.getElementById('execute-option-form') as HTMLFormElement)?.requestSubmit();
          }}
          on:cancel={closePanel}
          on:dteChange={async (e) => {
            if (activePanel) {
              activePanel = { ...activePanel, selectedDte: e.detail, prevTicketId: panelTicket?.id ?? null };
              await tick();
              (document.getElementById('queue-option-form') as HTMLFormElement)?.requestSubmit();
            }
          }}
        />
      {/if}
    {/if}

    <PutExposureChart rows={data.puts} />

    {#if data.puts.length > 0}
      <div class="put-execute-bar">
        <div class="put-execute-label">Execute CSP</div>
        {#each data.puts as row}
          <button class="put-exec-btn" type="button" on:click={() => handlePutExecute(row.symbol)}>
            ⚡ {row.symbol.replace(/^US\./, '')} ${row.strike} Put
          </button>
        {/each}
      </div>
    {/if}

    {#if activePanel?.optionType === 'put' && panelTicket}
      <ExecutionConfirmPanel
        tickets={[panelTicket]}
        mode="option"
        selectedDte={activePanel?.selectedDte ?? 30}
        loading={executionLoading}
        results={executionResult ? [executionResult] : null}
        on:confirm={() => {
          executionLoading = true;
          (document.getElementById('execute-option-form') as HTMLFormElement)?.requestSubmit();
        }}
        on:cancel={closePanel}
        on:dteChange={async (e) => {
          if (activePanel) {
            activePanel = { ...activePanel, selectedDte: e.detail, prevTicketId: panelTicket?.id ?? null };
            await tick();
            (document.getElementById('queue-option-form') as HTMLFormElement)?.requestSubmit();
          }
        }}
      />
    {/if}

    <div class="next-step">
      <div class="next-text">
        <strong>Review optimization history</strong>
        <span>Compare how your portfolio metrics and allocation targets have changed over past runs.</span>
      </div>
      <a class="button" href="/optimization/history">View History →</a>
    </div>
  </main>
  <aside class="side-col">
    <PremiumYieldCard premium={data.premium} />
    <AssignmentRiskCard score={data.exposure.assignment_risk_score} level={data.exposure.risk_level} warnings={data.exposure.warnings} />
    <CollateralUsageChart usagePct={data.exposure.collateral_usage_pct} collateral={data.exposure.collateral_locked} />
    {#if data.wheel.length > 0}
      <div class="wheel-label">Wheel Strategy</div>
      {#each data.wheel.slice(0, 3) as report}<WheelStrategyCard {report} />{/each}
    {/if}
  </aside>
</div>

<style>
  .actions-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .actions-left { display: flex; gap: 6px; flex-wrap: wrap; }
  .tab-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; color: var(--muted); background: var(--surface-1); border: 1px solid var(--border); text-decoration: none; transition: all 0.12s; }
  .tab-btn:hover { color: var(--text); border-color: var(--primary); }
  .notice { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .next-step { display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid rgba(var(--primary-rgb), 0.22); border-radius: 8px; background: rgba(var(--primary-rgb), 0.05); padding: 14px 16px; }
  .next-text { display: grid; gap: 3px; }
  .next-text strong { font-size: 0.82rem; color: var(--text); }
  .next-text span { font-size: 0.72rem; color: var(--muted); }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 22rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  .wheel-label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
  @media (max-width: 600px) { .actions-bar { flex-direction: column; align-items: flex-start; } }
  .put-execute-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--card); }
  .put-execute-label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em; margin-right: 4px; }
  .put-exec-btn { display: inline-flex; align-items: center; gap: 4px; font-size: 0.7rem; font-weight: 700; color: var(--primary); background: rgba(var(--primary-rgb), 0.08); border: 1px solid rgba(var(--primary-rgb), 0.25); border-radius: 4px; padding: 4px 10px; cursor: pointer; transition: all 0.1s; }
  .put-exec-btn:hover { background: rgba(var(--primary-rgb), 0.16); }
  .panel-loading { font-size: 0.72rem; color: var(--muted); padding: 10px 0; }
</style>
