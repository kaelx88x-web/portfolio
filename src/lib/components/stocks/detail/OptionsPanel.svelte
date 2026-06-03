<!-- OptionsPanel.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  export let symbol: string;

  type Expiry = { date: string; dte: number };
  type Row = {
    strike: number | null;
    option_type: string;
    bid: number | null;
    ask: number | null;
    mid: number | null;
    implied_volatility: number | null;
    delta: number | null;
    theta: number | null;
    open_interest: number | null;
  };
  // CC/CSP single-leg candidate (enriched) and bull-put/bear-call spread candidate.
  type Candidate = {
    // single-leg (cc/csp)
    strike?: number; option_type?: string; mid?: number; delta?: number | null;
    premium_yield_pct?: number | null;
    collateral_per_contract?: number | null;
    assignment_risk?: string | null;
    max_loss_per_contract?: number | null;
    shares_required?: number | null;
    // spread
    short_strike?: number; long_strike?: number; width?: number;
    net_credit?: number; max_profit?: number; max_loss?: number; short_delta?: number | null;
  };

  let expiries: Expiry[] = [];
  let expiry = '';
  let strategy: 'all' | 'cc' | 'csp' | 'spread' = 'all';
  let dteMin = 30, dteMax = 45;
  let deltaMin = 0.2, deltaMax = 0.35;
  let rows: Row[] = [];
  let candidates: Candidate[] = [];
  let loading = false;
  let fetchError = false;

  onMount(() => {
    init();
  });

  async function init() {
    loading = true;
    fetchError = false;
    try {
      const r = await fetch(
        `/api/stocks/${encodeURIComponent(symbol)}/options/expiry`,
        { signal: AbortSignal.timeout(8000) }
      ).then((x) => x.json());
      expiries = r.expiries ?? [];
      const inWindow = expiries.find((e) => e.dte >= dteMin && e.dte <= dteMax) ?? expiries[0];
      if (inWindow) {
        expiry = inWindow.date;
        await reload();
      } else {
        loading = false;
      }
    } catch {
      fetchError = true;
      loading = false;
    }
  }

  /** Dispatch by strategy: the plain chain for 'all', enriched candidates otherwise. */
  function reload() {
    return strategy === 'all' ? loadChain() : loadCandidates();
  }

  async function loadChain() {
    if (!expiry) return;
    loading = true;
    fetchError = false;
    try {
      const r = await fetch(
        `/api/stocks/${encodeURIComponent(symbol)}/options/chain?expiry=${expiry}&type=all`,
        { signal: AbortSignal.timeout(8000) }
      ).then((x) => x.json());
      rows = r.chain ?? [];
    } catch {
      fetchError = true;
      rows = [];
    } finally {
      loading = false;
    }
  }

  // CC/CSP/spread candidates come from the enriched /options/candidates endpoint
  // (collateral, assignment risk, max loss) — the plain chain lacks those fields.
  async function loadCandidates() {
    loading = true;
    fetchError = false;
    candidates = [];
    try {
      const p = new URLSearchParams();
      if (strategy === 'spread') {
        p.set('mode', 'spread');
        p.set('expiry', expiry);
        p.set('strategy', 'bull_put');
      } else {
        p.set('mode', strategy); // cc | csp
      }
      const r = await fetch(
        `/api/stocks/${encodeURIComponent(symbol)}/options/candidates?${p}`,
        { signal: AbortSignal.timeout(12000) }
      ).then((x) => x.json());
      candidates = r.candidates ?? [];
    } catch {
      fetchError = true;
      candidates = [];
    } finally {
      loading = false;
    }
  }

  $: visible = rows.filter(
    (r) => r.delta == null || (Math.abs(r.delta) >= deltaMin && Math.abs(r.delta) <= deltaMax)
  );

  function paper(r: Row) {
    goto(
      `/paper-trading?symbol=${encodeURIComponent(symbol)}&type=option&strike=${r.strike}&expiry=${expiry}&side=${r.option_type}`
    );
  }

  function paperCandidate(c: Candidate) {
    const side = strategy === 'cc' ? 'call' : 'put';
    goto(
      `/paper-trading?symbol=${encodeURIComponent(symbol)}&type=option&strike=${c.strike}&expiry=${expiry}&side=${side}`
    );
  }
</script>

<div class="op">
  <div class="op-bar">
    <div class="pills">
      {#each expiries.slice(0, 6) as e}
        <button
          class:active={expiry === e.date}
          on:click={() => { expiry = e.date; reload(); }}
        >{e.date.slice(5)} · {e.dte}d</button>
      {/each}
    </div>
    <div class="pills">
      {#each [['all', 'All'], ['cc', 'Covered call'], ['csp', 'Cash-secured put'], ['spread', 'Credit spread']] as [v, l] (v)}
        <button
          class:active={strategy === v}
          on:click={() => { strategy = v as typeof strategy; reload(); }}
        >{l}</button>
      {/each}
    </div>
  </div>

  <div class="op-filters">
    <label>DTE <input type="number" bind:value={dteMin} min="0" /> – <input type="number" bind:value={dteMax} min="0" /></label>
    <label>|Δ| <input type="number" step="0.05" bind:value={deltaMin} /> – <input type="number" step="0.05" bind:value={deltaMax} /></label>
  </div>

  {#if loading}
    <p class="op-msg">Loading…</p>
  {:else if fetchError || (expiries.length === 0)}
    <p class="op-msg">Data Not Available — options could not be loaded.</p>
  {:else if strategy === 'all'}
    {#if visible.length === 0}
      <p class="op-msg">Data Not Available for this expiry / filter.</p>
    {:else}
      <div class="op-table op-chain" role="table">
        <div class="op-thead" role="row">
          <span>Strike</span><span>Bid/Ask</span><span>IV</span><span>Δ</span><span>Θ</span><span>OI</span><span></span>
        </div>
        {#each visible as r}
          <div class="op-trow" role="row">
            <span>{r.strike?.toFixed(1)} {r.option_type?.[0]?.toUpperCase()}</span>
            <span>{r.bid?.toFixed(2) ?? '—'}/{r.ask?.toFixed(2) ?? '—'}</span>
            <span>{r.implied_volatility != null ? (r.implied_volatility * 100).toFixed(0) + '%' : '—'}</span>
            <span>{r.delta?.toFixed(2) ?? '—'}</span>
            <span>{r.theta?.toFixed(3) ?? '—'}</span>
            <span>{r.open_interest ?? '—'}</span>
            <span><button class="op-paper" on:click={() => paper(r)}>Paper</button></span>
          </div>
        {/each}
      </div>
    {/if}
  {:else if strategy === 'spread'}
    {#if candidates.length === 0}
      <p class="op-msg">Data Not Available — no credit-spread candidates for this expiry.</p>
    {:else}
      <div class="op-table op-spread" role="table">
        <div class="op-thead" role="row">
          <span>Short / Long</span><span>Width</span><span>Net credit</span><span>Max profit</span><span>Max loss</span><span>Δ</span>
        </div>
        {#each candidates as c}
          <div class="op-trow" role="row">
            <span>{c.short_strike?.toFixed(1)} / {c.long_strike?.toFixed(1)}</span>
            <span>{c.width != null ? c.width.toFixed(1) : '—'}</span>
            <span>{c.net_credit != null ? '$' + c.net_credit.toFixed(2) : '—'}</span>
            <span>{c.max_profit != null ? '$' + c.max_profit.toFixed(0) : '—'}</span>
            <span>{c.max_loss != null ? '$' + c.max_loss.toFixed(0) : '—'}</span>
            <span>{c.short_delta != null ? c.short_delta.toFixed(2) : '—'}</span>
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    {#if candidates.length === 0}
      <p class="op-msg">Data Not Available — no {strategy === 'cc' ? 'covered-call' : 'cash-secured put'} candidates.</p>
    {:else}
      <div class="op-table op-cand" role="table">
        <div class="op-thead" role="row">
          <span>Strike</span><span>Mid</span><span>Yield</span><span>Collateral</span><span>Assign</span><span>Risk</span><span></span>
        </div>
        {#each candidates as c}
          <div class="op-trow" role="row">
            <span>{c.strike?.toFixed(1)} {c.option_type?.[0]?.toUpperCase()}</span>
            <span>{c.mid != null ? '$' + c.mid.toFixed(2) : '—'}</span>
            <span>{c.premium_yield_pct != null ? c.premium_yield_pct.toFixed(1) + '%' : '—'}</span>
            <span>{c.collateral_per_contract != null ? '$' + c.collateral_per_contract.toFixed(0) : '—'}</span>
            <span class="risk risk-{c.assignment_risk ?? 'unknown'}">{c.assignment_risk ?? '—'}</span>
            <span>{c.max_loss_per_contract != null ? '$' + c.max_loss_per_contract.toFixed(0) : (c.shares_required != null ? c.shares_required + ' sh' : '—')}</span>
            <span><button class="op-paper" on:click={() => paperCandidate(c)}>Paper</button></span>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
  <p class="op-note">Read-only chain + paper-trade only — no live order path.</p>
</div>

<style>
  .op { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:14px; }
  .op-bar { display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:8px; }
  .pills { display:flex; gap:3px; flex-wrap:wrap; }
  .pills button { font-size:.65rem; font-weight:600; padding:3px 9px; border-radius:6px; border:1px solid var(--border); background:none; color:var(--muted); cursor:pointer; }
  .pills button.active { color:var(--primary); background:rgba(var(--primary-rgb),.14); border-color:var(--primary); }
  .op-filters { display:flex; gap:14px; margin-bottom:10px; font-size:.7rem; color:var(--muted); }
  .op-filters input { width:48px; background:var(--card); border:1px solid var(--border); border-radius:5px; color:var(--text); padding:2px 5px; }
  .op-table { border:1px solid var(--border); border-radius:8px; overflow:hidden; }
  .op-thead, .op-trow { display:grid; grid-template-columns:1.1fr 1.2fr .8fr .7fr .9fr .8fr .9fr; gap:0; align-items:center; }
  .op-thead { font-size:.6rem; text-transform:uppercase; color:var(--muted); padding:6px 8px; border-bottom:1px solid var(--border); }
  .op-trow { font-size:.74rem; color:var(--text); padding:6px 8px; border-bottom:1px solid var(--border); }
  .op-trow:last-child { border-bottom:none; }
  /* Enriched candidate tables (CC/CSP single-leg, and vertical spreads). */
  .op-cand .op-thead, .op-cand .op-trow { grid-template-columns:1fr .8fr .8fr 1.1fr .9fr 1fr .9fr; }
  .op-spread .op-thead, .op-spread .op-trow { grid-template-columns:1.4fr .7fr 1fr 1fr 1fr .7fr; }
  .risk { text-transform:capitalize; }
  .risk-high { color:var(--danger, #e5484d); }
  .risk-moderate { color:var(--warning, #d9a514); }
  .risk-low { color:var(--success, #30a46c); }
  .op-paper { font-size:.66rem; font-weight:600; padding:3px 8px; border-radius:5px; border:1px solid rgba(var(--primary-rgb),.3); background:rgba(var(--primary-rgb),.08); color:var(--primary); cursor:pointer; }
  .op-msg, .op-note { font-size:.72rem; color:var(--muted); padding:10px 2px; }
  @media (max-width:767px) {
    /* Only the dense chain table drops a column on mobile; candidate tables stay intact. */
    .op-chain .op-thead span:nth-child(3), .op-chain .op-trow span:nth-child(3) { display:none; }
    .op-chain .op-thead, .op-chain .op-trow { grid-template-columns:1.1fr 1.2fr .7fr .9fr .8fr .9fr; }
    .op-cand .op-thead, .op-cand .op-trow, .op-spread .op-thead, .op-spread .op-trow { font-size:.66rem; }
  }
</style>
