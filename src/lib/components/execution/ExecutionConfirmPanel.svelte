<!-- src/lib/components/execution/ExecutionConfirmPanel.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Zap, X, ExternalLink, AlertTriangle, CheckCircle2, XCircle } from 'lucide-svelte';
  import type { TradeTicket } from '$lib/services/trade-layer.service';
  import { DTE_OPTIONS, type DTE } from '$lib/services/execution-bridge.service';

  export let tickets: TradeTicket[] = [];
  export let skipped: Array<{ label: string; reason: string }> = [];
  export let mode: 'rebalance' | 'option' = 'rebalance';
  export let selectedDte: DTE = 30;
  export let loading = false;
  export let results: Array<{
    ticketId: string;
    status: string;
    message: string;
    brokerOrderId?: string | null;
  }> | null = null;

  const dispatch = createEventDispatcher<{
    confirm: void;
    cancel: void;
    dteChange: DTE;
    retry: void;
  }>();

  $: totalEst = tickets.reduce((s, t) => s + t.estimatedValue, 0);
  $: allBlocked = tickets.length > 0 && tickets.every((t) => (t.status as string) === 'blocked');
  $: confirmedCount = results?.filter((r) => r.status === 'submitted' || r.status === 'dry_run').length ?? 0;
  $: failedCount = results?.filter((r) => r.status !== 'submitted' && r.status !== 'dry_run').length ?? 0;

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);

  function handleDteKey(e: KeyboardEvent, dte: DTE) {
    const idx = DTE_OPTIONS.indexOf(dte);
    if (e.key === 'ArrowRight' && idx < DTE_OPTIONS.length - 1) dispatch('dteChange', DTE_OPTIONS[idx + 1]);
    if (e.key === 'ArrowLeft' && idx > 0) dispatch('dteChange', DTE_OPTIONS[idx - 1]);
  }
</script>

<div class="panel">
  <div class="panel-header">
    <div class="panel-title"><Zap size={13} /> Confirm Execution — Paper Trading</div>
    <button class="close-btn" type="button" on:click={() => dispatch('cancel')} aria-label="Cancel">
      <X size={14} />
    </button>
  </div>

  {#if results}
    <!-- ── Result state ── -->
    <div class="results">
      {#each results as r}
        <div class="result-row" class:result-ok={r.status === 'submitted' || r.status === 'dry_run'} class:result-fail={r.status !== 'submitted' && r.status !== 'dry_run'}>
          {#if r.status === 'submitted' || r.status === 'dry_run'}
            <CheckCircle2 size={13} />
          {:else}
            <XCircle size={13} />
          {/if}
          <span class="result-msg">{r.message}</span>
          {#if r.brokerOrderId}<span class="order-id">{r.brokerOrderId}</span>{/if}
        </div>
      {/each}
      <div class="result-footer">
        <span>{confirmedCount} submitted · {failedCount} failed</span>
        <a class="view-link" href="/trades"><ExternalLink size={11} /> View in Trades</a>
      </div>
    </div>

  {:else}
    <!-- ── Pre-confirm state ── -->
    <div class="trade-rows">
      {#each tickets as ticket}
        <div class="trade-row">
          <div class="trade-info">
            <span
              class="side-badge"
              class:side-buy={ticket.side === 'buy'}
              class:side-sell={ticket.side === 'sell'}
              class:side-open={ticket.side === 'open'}
            >
              {ticket.side === 'buy' ? 'BUY' : ticket.side === 'sell' ? 'SELL' : 'OPEN'}
            </span>
            <span class="symbol">{ticket.symbol}</span>
            <span class="detail">
              {ticket.quantity} ·
              {ticket.orderType === 'limit' && ticket.limitPrice != null
                ? `limit $${ticket.limitPrice.toFixed(2)}`
                : 'market'}
            </span>
          </div>
          <div class="trade-right">
            <span class="est-val">{fmt(ticket.estimatedValue)}</span>
            <span class="safety" class:ok={(ticket.status as string) !== 'blocked'} class:blocked={(ticket.status as string) === 'blocked'}>
              {(ticket.status as string) === 'blocked' ? '✗ blocked' : '✓ pass'}
            </span>
          </div>
        </div>
      {/each}

      {#if skipped.length > 0}
        <details class="skipped">
          <summary><AlertTriangle size={11} /> {skipped.length} skipped (price unavailable)</summary>
          <div class="skipped-list">
            {#each skipped as s}<div class="skipped-item">{s.label} — {s.reason}</div>{/each}
            <button type="button" class="retry-btn" on:click={() => dispatch('retry')}>Retry skipped</button>
          </div>
        </details>
      {/if}
    </div>

    {#if mode === 'option'}
      <div class="dte-picker">
        <div class="dte-label">Expiry (DTE)</div>
        <div class="dte-pills" role="group" aria-label="Days to expiration">
          {#each DTE_OPTIONS as dte}
            <button
              type="button"
              class="dte-pill"
              class:dte-active={selectedDte === dte}
              on:click={() => dispatch('dteChange', dte)}
              on:keydown={(e) => handleDteKey(e, dte)}
              aria-pressed={selectedDte === dte}
            >{dte}d</button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="summary-bar">
      <span class="summary-count">{tickets.length} trade{tickets.length !== 1 ? 's' : ''} · est. {fmt(totalEst)}</span>
      <span class="paper-badge">📄 PAPER</span>
    </div>

    <div class="actions">
      <button
        class="btn-confirm"
        type="button"
        disabled={loading || allBlocked}
        on:click={() => dispatch('confirm')}
      >
        {#if loading}<span class="spin"></span>{:else}<Zap size={13} />{/if}
        {loading ? 'Submitting…' : 'Confirm & Submit to Paper'}
      </button>
      <button class="btn-cancel" type="button" on:click={() => dispatch('cancel')}>Cancel</button>
    </div>
  {/if}
</div>

<style>
  .panel { border: 2px solid var(--primary); border-radius: 8px; background: rgba(var(--primary-rgb), 0.03); overflow: hidden; margin-top: 10px; }
  .panel-header { display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; border-bottom: 1px solid var(--border); background: rgba(var(--primary-rgb), 0.06); }
  .panel-title { display: flex; align-items: center; gap: 6px; font-size: 0.65rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em; }
  .close-btn { background: none; border: none; color: var(--muted); cursor: pointer; padding: 2px; display: flex; align-items: center; border-radius: 4px; }
  .close-btn:hover { color: var(--text); }

  .trade-rows { display: grid; gap: 6px; padding: 10px 10px 0; }
  .trade-row { display: flex; justify-content: space-between; align-items: center; background: var(--surface-1); border: 1px solid var(--border); border-radius: 6px; padding: 7px 10px; }
  .trade-info { display: flex; align-items: center; gap: 6px; }
  .side-badge { font-weight: 800; font-size: 0.62rem; padding: 2px 5px; border-radius: 3px; }
  .side-buy { background: rgba(74,222,128,0.14); color: #4ade80; }
  .side-sell { background: rgba(248,113,113,0.14); color: #f87171; }
  .side-open { background: rgba(99,102,241,0.14); color: #818cf8; }
  .symbol { font-size: 0.75rem; font-weight: 700; color: var(--text); }
  .detail { font-size: 0.68rem; color: var(--muted); }
  .trade-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  .est-val { font-size: 0.72rem; color: var(--text); }
  .safety { font-size: 0.62rem; }
  .ok { color: #4ade80; }
  .blocked { color: #f87171; }

  .skipped { padding: 8px 10px 0; font-size: 0.7rem; color: var(--muted); }
  .skipped summary { cursor: pointer; display: flex; align-items: center; gap: 5px; list-style: none; }
  .skipped-list { margin-top: 6px; display: grid; gap: 3px; padding-left: 10px; }
  .skipped-item { font-size: 0.68rem; }
  .retry-btn { margin-top: 6px; font-size: 0.68rem; color: var(--primary); background: none; border: none; cursor: pointer; padding: 0; text-decoration: underline; }

  .dte-picker { padding: 10px 10px 0; }
  .dte-label { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; letter-spacing: 0.04em; }
  .dte-pills { display: flex; gap: 6px; }
  .dte-pill { border: 1px solid var(--border); border-radius: 4px; padding: 4px 10px; font-size: 0.72rem; color: var(--muted); background: var(--surface-1); cursor: pointer; transition: all 0.1s; }
  .dte-pill:hover { border-color: var(--primary); color: var(--primary); }
  .dte-active { border: 2px solid var(--primary) !important; color: var(--primary); font-weight: 700; background: rgba(var(--primary-rgb), 0.08); }

  .summary-bar { display: flex; justify-content: space-between; align-items: center; padding: 9px 10px; border-top: 1px solid var(--border); margin-top: 10px; }
  .summary-count { font-size: 0.72rem; color: var(--muted); }
  .paper-badge { font-size: 0.63rem; font-weight: 700; color: #818cf8; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.25); border-radius: 4px; padding: 2px 7px; }

  .actions { display: flex; gap: 8px; padding: 9px 10px; }
  .btn-confirm { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; background: var(--primary); color: white; border: none; border-radius: 6px; padding: 7px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: opacity 0.12s; }
  .btn-confirm:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-cancel { background: var(--surface-1); color: var(--muted); border: 1px solid var(--border); border-radius: 6px; padding: 7px 12px; font-size: 0.75rem; cursor: pointer; }

  .results { padding: 10px; display: grid; gap: 6px; }
  .result-row { display: flex; align-items: center; gap: 8px; font-size: 0.74rem; padding: 6px 8px; border-radius: 4px; }
  .result-ok { background: rgba(74,222,128,0.07); color: #4ade80; }
  .result-fail { background: rgba(248,113,113,0.07); color: #f87171; }
  .result-msg { flex: 1; }
  .order-id { font-size: 0.62rem; opacity: 0.65; }
  .result-footer { border-top: 1px solid var(--border); padding-top: 8px; font-size: 0.7rem; color: var(--muted); display: flex; justify-content: space-between; align-items: center; }
  .view-link { display: flex; align-items: center; gap: 4px; color: var(--primary); text-decoration: none; font-size: 0.68rem; }

  .spin { width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
