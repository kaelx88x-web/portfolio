<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-svelte';
  import type { PageData } from './$types';
  import type { CapitalFlowItem, CapitalDistributionItem, StockBasicInfo, QuoteSnapshot } from '$lib/services/broker.service';

  export let data: PageData;

  const POLL_MS = 30_000;

  let flow: CapitalFlowItem         = data.flow;
  let distribution: CapitalDistributionItem | null = data.distribution;
  let snapshot: QuoteSnapshot | null = data.snapshot;
  const basicInfo: StockBasicInfo | null = data.basicInfo;

  let fetchedAt = new Date();
  let secondsAgo = 0;
  let polling = false;
  let pollError = '';

  // ── Ticker / identity ──────────────────────────────────────────────
  $: ticker = data.symbol.split('.').pop() ?? data.symbol;

  // ── Price ──────────────────────────────────────────────────────────
  $: price     = snapshot?.last_price      ?? null;
  $: prevClose = snapshot?.prev_close_price ?? null;
  $: change    = price !== null && prevClose !== null ? price - prevClose : null;
  $: changePct = change !== null && prevClose ? (change / prevClose) * 100 : null;

  // ── Capital flow ───────────────────────────────────────────────────
  $: net    = flow.in_flow ?? 0;
  $: netCls = net > 1000 ? 'up' : net < -1000 ? 'dn' : 'flat';

  $: flowRows = [
    { tier: 'Super', label: 'Super', desc: 'Institutional block orders', value: flow.super_in_flow ?? 0 },
    { tier: 'Big',   label: 'Big',   desc: 'Large fund / prop orders',   value: flow.big_in_flow   ?? 0 },
    { tier: 'Mid',   label: 'Mid',   desc: 'Medium active traders',      value: flow.mid_in_flow   ?? 0 },
    { tier: 'Small', label: 'Retail',desc: 'Individual retail orders',   value: flow.sml_in_flow   ?? 0 },
  ];
  $: flowMax = Math.max(...flowRows.map(r => Math.abs(r.value)), 1);

  // ── Distribution ───────────────────────────────────────────────────
  $: distRows = distribution && !distribution.error ? [
    { tier: 'Super', label: 'Super',  buy: distribution.super_in ?? 0, sell: distribution.super_out ?? 0 },
    { tier: 'Big',   label: 'Big',    buy: distribution.big_in   ?? 0, sell: distribution.big_out   ?? 0 },
    { tier: 'Mid',   label: 'Mid',    buy: distribution.mid_in   ?? 0, sell: distribution.mid_out   ?? 0 },
    { tier: 'Small', label: 'Retail', buy: distribution.sml_in   ?? 0, sell: distribution.sml_out   ?? 0 },
  ] : [];
  $: distMax     = Math.max(...distRows.flatMap(r => [r.buy, r.sell]), 1);
  $: hasDistData = distMax >= 1000;
  $: totalBuy    = distRows.reduce((s, r) => s + r.buy, 0);
  $: totalSell   = distRows.reduce((s, r) => s + r.sell, 0);

  // ── 52-week range ──────────────────────────────────────────────────
  $: rangePos = basicInfo?.high_52wk && basicInfo?.low_52wk && price !== null
    ? Math.min(100, Math.max(0, ((price - basicInfo.low_52wk) / (basicInfo.high_52wk - basicInfo.low_52wk)) * 100))
    : null;

  // ── Formatters ─────────────────────────────────────────────────────
  function fmtFlow(v: number): string {
    const abs = Math.abs(v);
    const sign = v >= 0 ? '+' : '-';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }

  function fmtAmt(v: number): string {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `$${(abs / 1_000).toFixed(0)}K`;
    return `$${abs.toFixed(0)}`;
  }

  function fmtCap(v: number | null): string {
    if (v === null) return '—';
    if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (v >= 1e9)  return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6)  return `$${(v / 1e6).toFixed(1)}M`;
    return `$${v.toLocaleString()}`;
  }

  function barPct(v: number, max: number): string {
    return `${Math.max((Math.abs(v) / max) * 100, 2).toFixed(1)}%`;
  }

  // ── Polling ────────────────────────────────────────────────────────
  async function fetchLatest() {
    if (polling) return;
    polling = true;
    pollError = '';
    try {
      const res = await fetch(`/api/capital/${encodeURIComponent(data.symbol)}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const body = await res.json();
      if (body.flow)         flow         = body.flow;
      if (body.distribution) distribution = body.distribution;
      if (body.snapshot)     snapshot     = body.snapshot;
      fetchedAt  = new Date(body.fetchedAt);
      secondsAgo = 0;
    } catch (e) {
      pollError = e instanceof Error ? e.message : 'fetch failed';
    } finally {
      polling = false;
    }
  }

  let pollTimer:  ReturnType<typeof setInterval>;
  let clockTimer: ReturnType<typeof setInterval>;

  onMount(() => {
    pollTimer  = setInterval(() => { if (document.visibilityState === 'visible') fetchLatest(); }, POLL_MS);
    clockTimer = setInterval(() => { secondsAgo += 1; }, 1000);
    document.addEventListener('visibilitychange', onVisibility);
  });
  onDestroy(() => {
    clearInterval(pollTimer);
    clearInterval(clockTimer);
    document.removeEventListener('visibilitychange', onVisibility);
  });
  function onVisibility() { if (document.visibilityState === 'visible') fetchLatest(); }
</script>

<div class="page">
<!-- ────────────────────────────────── TOP BAR -->
<div class="topbar">
  <a href="/holdings" class="back-btn"><ArrowLeft size={13} /> Holdings</a>
  <div class="poll-row">
    {#if polling}
      <RefreshCw size={10} class="spin" /> <span class="poll-txt">Updating…</span>
    {:else if pollError}
      <span class="poll-err">⚠ {pollError}</span>
    {:else}
      <span class="poll-txt">{secondsAgo}s ago</span>
    {/if}
    <button class="btn-refresh" on:click={fetchLatest} disabled={polling}>
      <RefreshCw size={11} class={polling ? 'spin' : ''} />
    </button>
  </div>
</div>

<!-- ────────────────────────────────── STOCK HERO -->
<div class="hero-card">
  <div class="hero-left">
    <div class="hero-ticker">{ticker}</div>
    {#if basicInfo?.name}
      <div class="hero-name">{basicInfo.name}</div>
    {/if}
    <div class="hero-badges">
      {#if basicInfo?.exchange}<span class="badge">{basicInfo.exchange.replace('US_', '')}</span>{/if}
      {#if basicInfo?.stock_type}<span class="badge">{basicInfo.stock_type}</span>{/if}
      {#if basicInfo?.lot_size}<span class="badge muted">Lot {basicInfo.lot_size}</span>{/if}
      {#if basicInfo?.suspension}<span class="badge danger">Suspended</span>{/if}
    </div>
    {#if basicInfo?.listing_date}
      <div class="hero-since">Listed {new Date(basicInfo.listing_date).getFullYear()}</div>
    {/if}
  </div>

  <div class="hero-right">
    {#if price !== null}
      <div class="hero-price">${price.toFixed(2)}</div>
      {#if change !== null && changePct !== null}
        <div class="hero-change" class:up={change > 0} class:dn={change < 0} class:flat={change === 0}>
          {#if change > 0}<TrendingUp size={12} />{:else if change < 0}<TrendingDown size={12} />{:else}<Minus size={12} />{/if}
          {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
        </div>
      {/if}
      {#if prevClose}
        <div class="hero-prev">Prev close ${prevClose.toFixed(2)}</div>
      {/if}
    {:else}
      <div class="hero-no-price">Price unavailable</div>
    {/if}
  </div>
</div>

<!-- ────────────────────────────────── STATS STRIP -->
{#if basicInfo}
<div class="stats-strip">
  <div class="stat-cell">
    <div class="stat-lbl">Market Cap</div>
    <div class="stat-val">{fmtCap(basicInfo.market_cap)}</div>
  </div>
  <div class="stat-sep"></div>
  <div class="stat-cell">
    <div class="stat-lbl">P/E TTM</div>
    <div class="stat-val">{basicInfo.pe_ttm ? basicInfo.pe_ttm.toFixed(1) + '×' : '—'}</div>
  </div>
  <div class="stat-sep"></div>
  <div class="stat-cell">
    <div class="stat-lbl">P/B</div>
    <div class="stat-val">{basicInfo.pb_ratio ? basicInfo.pb_ratio.toFixed(2) + '×' : '—'}</div>
  </div>
  <div class="stat-sep"></div>
  <div class="stat-cell">
    <div class="stat-lbl">EPS</div>
    <div class="stat-val" class:dn={basicInfo.eps !== null && basicInfo.eps < 0}>
      {basicInfo.eps !== null ? (basicInfo.eps < 0 ? '-' : '') + '$' + Math.abs(basicInfo.eps).toFixed(2) : '—'}
    </div>
  </div>
</div>
{/if}

<!-- ────────────────────────────────── 52-WEEK RANGE -->
{#if basicInfo?.high_52wk && basicInfo?.low_52wk}
<div class="range-card">
  <div class="range-head">
    <span class="range-title">52-Week Range</span>
    {#if rangePos !== null}
      <span class="range-pos-lbl">{rangePos.toFixed(0)}% from low</span>
    {/if}
  </div>
  <div class="range-track-wrap">
    <div class="range-track">
      {#if rangePos !== null}
        <div class="range-fill" style="width:{rangePos.toFixed(1)}%"></div>
        <div class="range-needle" style="left:{rangePos.toFixed(1)}%"></div>
      {/if}
    </div>
  </div>
  <div class="range-ends">
    <span class="range-lo">${basicInfo.low_52wk.toFixed(2)}</span>
    {#if price !== null && rangePos !== null}
      <span class="range-cur">${price.toFixed(2)}</span>
    {/if}
    <span class="range-hi">${basicInfo.high_52wk.toFixed(2)}</span>
  </div>
</div>
{/if}

<!-- ────────────────────────────────── CAPITAL FLOW -->
<div class="section-card">
  <div class="section-hd">
    <span class="section-label">Capital Flow</span>
    <span class="flow-badge {netCls}">
      {#if net > 1000}▲ Buying{:else if net < -1000}▼ Selling{:else}⟺ Balanced{/if}
    </span>
    <span class="net-amt {netCls}">{fmtFlow(net)} net</span>
  </div>

  <div class="bidir-col-heads">
    <span class="col-head-out">Outflow</span>
    <span class="col-head-in">Inflow</span>
  </div>

  <div class="bidir-rows">
    {#each flowRows as row}
      {@const isIn  = row.value > 1000}
      {@const isOut = row.value < -1000}
      {@const pct   = barPct(row.value, flowMax)}
      <div class="bidir-row">
        <div class="tier-label">
          <span class="tier-name">{row.label}</span>
          <span class="tier-desc">{row.desc}</span>
        </div>
        <div class="bidir-bars">
          <div class="half-track out-track">
            {#if isOut}
              <div class="half-bar bar-out" style="width:{pct}"></div>
            {/if}
          </div>
          <div class="center-pin"></div>
          <div class="half-track in-track">
            {#if isIn}
              <div class="half-bar bar-in" style="width:{pct}"></div>
            {/if}
          </div>
        </div>
        <div class="bidir-val">
          {#if isIn}
            <span class="val-in">{fmtFlow(row.value)}</span>
          {:else if isOut}
            <span class="val-out">{fmtFlow(row.value)}</span>
          {:else}
            <span class="val-flat">—</span>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <div class="flow-legend">
    <span><span class="dot dot-in"></span> Inflow = buying pressure</span>
    <span><span class="dot dot-out"></span> Outflow = selling pressure</span>
  </div>

  <div class="insight-strip">
    <strong>Super/Big inflow</strong> = institutions buying (bullish).
    <strong>Big outflow</strong> + small inflow = distribution (bearish). Advisory only.
  </div>
</div>

<!-- ────────────────────────────────── DISTRIBUTION -->
{#if distribution && !distribution.error}
<div class="section-card">
  <div class="section-hd">
    <span class="section-label">Buy vs Sell Distribution</span>
    {#if hasDistData}
      <span class="dist-totals">
        <span class="val-in">↑{fmtAmt(totalBuy)}</span>
        <span class="val-out">↓{fmtAmt(totalSell)}</span>
      </span>
    {/if}
  </div>

  {#if !hasDistData}
    <div class="closed-note">Market closed or no intraday activity recorded today.</div>
  {:else}
    <div class="dist-col-heads">
      <span>Buy</span>
      <span>Sell</span>
    </div>
    <div class="dist-rows">
      {#each distRows as dr}
        {@const net = dr.buy - dr.sell}
        <div class="dist-row">
          <div class="tier-label">
            <span class="tier-name">{dr.label}</span>
          </div>
          <div class="dist-bars">
            <div class="dist-buy-val">{fmtAmt(dr.buy)}</div>
            <div class="half-track dist-buy-track">
              <div class="half-bar bar-in dist-bar" style="width:{barPct(dr.buy, distMax)}"></div>
            </div>
            <div class="center-pin"></div>
            <div class="half-track dist-sell-track">
              <div class="half-bar bar-out dist-bar" style="width:{barPct(dr.sell, distMax)}"></div>
            </div>
            <div class="dist-sell-val">{fmtAmt(dr.sell)}</div>
          </div>
          <div class="dist-net" class:val-in={net > 0} class:val-out={net < 0} class:val-flat={net === 0}>
            {net > 0 ? '+' : net < 0 ? '' : '='}{net !== 0 ? fmtAmt(net) : '0'}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
{/if}

{#if flow.error}
  <div class="error-note">⚠ {flow.error}</div>
{/if}
</div>

<style>
  .page { max-width: 700px; padding-bottom: 40px; }
  /* ── Layout ─────────────────────────────────────────── */

  /* ── Top bar ─────────────────────────────────────────── */
  .topbar {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 16px;
  }
  .back-btn {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 0.75rem; color: var(--muted); text-decoration: none; transition: color 0.15s;
  }
  .back-btn:hover { color: var(--primary); }
  .poll-row {
    display: flex; align-items: center; gap: 6px;
  }
  .poll-txt { font-size: 0.68rem; color: var(--muted); }
  .poll-err { font-size: 0.68rem; color: var(--danger); }
  .btn-refresh {
    display: flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; border-radius: 6px;
    border: 1px solid var(--border); background: transparent;
    color: var(--muted); cursor: pointer; transition: all 0.15s;
  }
  .btn-refresh:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
  .btn-refresh:disabled { opacity: 0.4; cursor: not-allowed; }
  :global(.spin) { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Hero card ───────────────────────────────────────── */
  .hero-card {
    display: flex; justify-content: space-between; align-items: flex-start;
    background: var(--card); border: 1px solid var(--border);
    border-radius: 14px; padding: 20px 24px; margin-bottom: 10px;
  }
  .hero-left { min-width: 0; }
  .hero-ticker {
    font-size: 2rem; font-weight: 800; color: var(--primary);
    letter-spacing: -0.03em; line-height: 1;
  }
  .hero-name { font-size: 0.8rem; color: var(--muted); margin: 3px 0 8px; }
  .hero-badges { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 6px; }
  .badge {
    font-size: 0.63rem; font-weight: 600; padding: 2px 7px;
    border-radius: 4px; border: 1px solid var(--border);
    background: var(--surface-1); color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .badge.muted  { color: var(--muted); }
  .badge.danger { border-color: var(--danger); color: var(--danger); background: rgba(var(--danger-rgb),0.08); }
  .hero-since   { font-size: 0.65rem; color: var(--muted); }

  .hero-right { text-align: right; flex-shrink: 0; }
  .hero-price { font-size: 1.9rem; font-weight: 800; letter-spacing: -0.03em; color: var(--text); }
  .hero-change {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 0.82rem; font-weight: 600; margin-top: 3px;
  }
  .hero-change.up   { color: var(--success); }
  .hero-change.dn   { color: var(--danger); }
  .hero-change.flat { color: var(--muted); }
  .hero-prev    { font-size: 0.65rem; color: var(--muted); margin-top: 4px; }
  .hero-no-price{ font-size: 0.72rem; color: var(--muted); margin-top: 8px; }

  /* ── Stats strip ─────────────────────────────────────── */
  .stats-strip {
    display: flex; align-items: center;
    background: var(--card); border: 1px solid var(--border);
    border-radius: 10px; padding: 12px 20px; margin-bottom: 10px;
  }
  .stat-cell { flex: 1; text-align: center; }
  .stat-lbl  { font-size: 0.62rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 3px; }
  .stat-val  { font-size: 0.9rem; font-weight: 700; color: var(--text); }
  .stat-val.dn { color: var(--danger); }
  .stat-sep  { width: 1px; height: 28px; background: var(--border); margin: 0 8px; flex-shrink: 0; }

  /* ── 52-week range ───────────────────────────────────── */
  .range-card {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px 20px; margin-bottom: 10px;
  }
  .range-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .range-title { font-size: 0.65rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
  .range-pos-lbl { font-size: 0.68rem; color: var(--primary); font-weight: 600; }
  .range-track-wrap { padding: 0 4px; }
  .range-track {
    height: 6px; background: var(--surface-1); border-radius: 4px;
    position: relative; overflow: visible;
  }
  .range-fill {
    position: absolute; left: 0; top: 0; height: 100%;
    background: linear-gradient(90deg, rgba(var(--primary-rgb),0.3), rgba(var(--primary-rgb),0.7));
    border-radius: 4px; transition: width 0.4s ease;
  }
  .range-needle {
    position: absolute; top: 50%; transform: translate(-50%, -50%);
    width: 12px; height: 12px; border-radius: 50%;
    background: var(--primary); border: 2px solid var(--bg);
    box-shadow: 0 0 0 1px var(--primary);
    transition: left 0.4s ease;
  }
  .range-ends {
    display: flex; justify-content: space-between; align-items: center;
    margin-top: 8px;
  }
  .range-lo  { font-size: 0.68rem; color: var(--muted); font-weight: 600; }
  .range-hi  { font-size: 0.68rem; color: var(--muted); font-weight: 600; }
  .range-cur { font-size: 0.7rem; color: var(--primary); font-weight: 700; }

  /* ── Section cards ───────────────────────────────────── */
  .section-card {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; padding: 18px 20px; margin-bottom: 10px;
  }
  .section-hd {
    display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .section-label {
    font-size: 0.65rem; font-weight: 700; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.08em;
  }

  /* ── Flow badge & net ────────────────────────────────── */
  .flow-badge {
    font-size: 0.65rem; font-weight: 700; padding: 2px 8px;
    border-radius: 4px; letter-spacing: 0.04em;
  }
  .flow-badge.up   { background: rgba(var(--success-rgb),0.12); color: var(--success); border: 1px solid rgba(var(--success-rgb),0.25); }
  .flow-badge.dn   { background: rgba(var(--danger-rgb), 0.12); color: var(--danger);  border: 1px solid rgba(var(--danger-rgb), 0.25); }
  .flow-badge.flat { background: var(--surface-1);               color: var(--muted);  border: 1px solid var(--border); }
  .net-amt { font-size: 0.78rem; font-weight: 700; margin-left: auto; }
  .net-amt.up   { color: var(--success); }
  .net-amt.dn   { color: var(--danger);  }
  .net-amt.flat { color: var(--muted);   }

  /* ── Bidirectional bars (shared) ─────────────────────── */
  .bidir-col-heads {
    display: flex; justify-content: space-between;
    font-size: 0.6rem; color: var(--muted); text-transform: uppercase;
    letter-spacing: 0.06em; margin-bottom: 8px; padding: 0 0 0 120px;
  }
  .bidir-rows { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
  .bidir-row  { display: grid; grid-template-columns: 120px 1fr 72px; align-items: center; gap: 8px; }

  .dist-col-heads {
    display: flex; justify-content: space-between;
    font-size: 0.6rem; color: var(--muted); text-transform: uppercase;
    letter-spacing: 0.06em; margin-bottom: 8px; padding: 0 72px 0 120px;
  }

  .tier-label { min-width: 0; }
  .tier-name  { display: block; font-size: 0.78rem; font-weight: 600; color: var(--text); }
  .tier-desc  { display: block; font-size: 0.63rem; color: var(--muted); margin-top: 1px; }

  .bidir-bars {
    display: grid; grid-template-columns: 1fr 6px 1fr; gap: 3px; align-items: center;
  }

  .half-track { height: 8px; border-radius: 4px; overflow: hidden; background: var(--surface-1); }
  .out-track  { display: flex; justify-content: flex-end; }
  .in-track   { display: flex; justify-content: flex-start; }

  .half-bar { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
  .bar-in  { background: var(--success); }
  .bar-out { background: var(--danger);  }

  .center-pin { width: 2px; height: 16px; background: var(--border); border-radius: 2px; justify-self: center; }

  .bidir-val { font-size: 0.75rem; font-weight: 700; text-align: right; }
  .val-in   { color: var(--success); }
  .val-out  { color: var(--danger);  }
  .val-flat { color: var(--muted);   }

  /* ── Flow legend & insight ───────────────────────────── */
  .flow-legend {
    display: flex; gap: 16px; margin-bottom: 10px;
    border-top: 1px solid var(--border); padding-top: 10px;
  }
  .flow-legend span { display: flex; align-items: center; gap: 5px; font-size: 0.68rem; color: var(--muted); }
  .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .dot-in  { background: var(--success); }
  .dot-out { background: var(--danger);  }

  .insight-strip {
    font-size: 0.7rem; color: var(--muted); line-height: 1.5;
    padding: 8px 12px; border-radius: 6px;
    background: rgba(var(--primary-rgb),0.04);
    border: 1px solid rgba(var(--primary-rgb),0.1);
  }
  .insight-strip strong { color: var(--text); }

  /* ── Distribution ────────────────────────────────────── */
  .dist-totals { display: flex; gap: 8px; margin-left: auto; font-size: 0.75rem; font-weight: 700; }
  .dist-rows   { display: flex; flex-direction: column; gap: 10px; }
  .dist-row    { display: grid; grid-template-columns: 120px 1fr 56px; align-items: center; gap: 8px; }

  .dist-bars   {
    display: grid; grid-template-columns: 48px 1fr 6px 1fr 48px; gap: 3px; align-items: center;
  }
  .dist-buy-track  { display: flex; justify-content: flex-end; }
  .dist-sell-track { display: flex; justify-content: flex-start; }
  .dist-bar { border-radius: 3px; }
  .dist-buy-val  { font-size: 0.63rem; font-weight: 600; color: var(--success); text-align: right; }
  .dist-sell-val { font-size: 0.63rem; font-weight: 600; color: var(--danger);  text-align: left; }
  .dist-net { font-size: 0.72rem; font-weight: 700; text-align: right; }

  .closed-note {
    font-size: 0.72rem; color: var(--muted); padding: 10px 12px;
    border-radius: 6px; background: var(--surface-1); border: 1px solid var(--border);
  }

  /* ── Up / down colours ───────────────────────────────── */
  .up   { color: var(--success); }
  .dn   { color: var(--danger);  }
  .flat { color: var(--muted);   }

  .error-note {
    margin-top: 10px; font-size: 0.72rem; color: var(--muted);
    padding: 8px 12px; border-radius: 6px;
    background: rgba(var(--warning-rgb),0.08);
    border: 1px solid rgba(var(--warning-rgb),0.2);
  }
</style>
