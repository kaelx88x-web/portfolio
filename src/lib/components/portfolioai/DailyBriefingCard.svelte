<!-- src/lib/components/portfolioai/DailyBriefingCard.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import type { DailyBriefing } from '$lib/types/briefing';
  import { money as formatMoney } from '$lib/format';

  export let briefing: DailyBriefing;
  export let currency: string = 'USD';

  let generating = false;

  function money(n: number): string {
    return formatMoney(Math.abs(n), currency);
  }

  function signedMoney(n: number): string {
    return (n >= 0 ? '+' : '−') + money(n);
  }

  function pct(n: number, decimals = 2): string {
    return (n >= 0 ? '+' : '') + n.toFixed(decimals) + '%';
  }

  function fmtTime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  $: healthColor =
    briefing.healthScore >= 70
      ? 'var(--success)'
      : briefing.healthScore >= 45
        ? 'var(--warning)'
        : 'var(--danger)';

  $: healthIcon =
    briefing.healthScore >= 70 ? '✓' : briefing.healthScore >= 45 ? '⚠' : '⛔';

  $: dayPlColor =
    briefing.dayPl === null
      ? 'var(--muted)'
      : briefing.dayPl >= 0
        ? 'var(--success)'
        : 'var(--danger)';

  $: unrealisedColor =
    briefing.unrealisedPnl >= 0 ? 'var(--success)' : 'var(--danger)';

  $: thetaColor = briefing.thetaToday > 0 ? 'var(--success)' : 'var(--muted)';

  $: regimeColor =
    briefing.marketRegime === 'Risk-On'
      ? 'var(--success)'
      : briefing.marketRegime === 'Bearish' || briefing.marketRegime === 'Risk-Off'
        ? 'var(--danger)'
        : 'var(--text)';

  $: moverColor =
    briefing.topMover === null
      ? 'var(--muted)'
      : briefing.topMover.changePercent >= 0
        ? 'var(--success)'
        : 'var(--danger)';

  const dotColor = {
    warning: 'var(--warning)',
    success: 'var(--success)',
    info: 'var(--primary)',
  } as const;
</script>

<div class="card">

  <!-- ① AI HEADLINE BAR -->
  <div class="top">
    <div class="label-row">
      <span class="label-text">✦ AI MORNING BRIEFING</span>
      {#if briefing.headlineGeneratedAt}
        <span class="label-time">Generated {fmtTime(briefing.headlineGeneratedAt)}</span>
      {/if}
    </div>
    {#if briefing.aiHeadline}
      <p class="headline"><em>{briefing.aiHeadline}</em></p>
    {:else}
      <p class="headline-empty">No brief yet — click <strong>Regenerate brief</strong> below to generate your first morning briefing.</p>
    {/if}
  </div>

  <!-- ② DATA GRID — 6 cells -->
  <div class="grid">

    <!-- Health -->
    <div class="cell">
      <div class="cell-label">HEALTH</div>
      <div class="cell-val" style="color:{healthColor}">
        {briefing.healthScore}<span class="cell-denom">/100</span>
      </div>
      <div class="cell-sub">{briefing.healthLabel} {healthIcon}</div>
    </div>

    <!-- Day P&L -->
    <div class="cell">
      <div class="cell-label">DAY P&amp;L</div>
      <div class="cell-val" style="color:{dayPlColor}">
        {briefing.dayPl !== null ? signedMoney(briefing.dayPl) : '—'}
      </div>
      <div class="cell-sub">
        {briefing.dayPlPct !== null ? pct(briefing.dayPlPct) : 'No broker sync'}
      </div>
    </div>

    <!-- Unrealised -->
    <div class="cell">
      <div class="cell-label">UNREALISED</div>
      <div class="cell-val" style="color:{unrealisedColor}">{signedMoney(briefing.unrealisedPnl)}</div>
      <div class="cell-sub">{pct(briefing.unrealisedPnlPct)} total</div>
    </div>

    <!-- Theta -->
    <div class="cell">
      <div class="cell-label">THETA TODAY</div>
      <div class="cell-val" style="color:{thetaColor}">
        {briefing.thetaToday > 0 ? '+' + money(briefing.thetaToday) : '—'}
      </div>
      <div class="cell-sub">
        {briefing.optionsCount > 0
          ? briefing.optionsCount + ' contract' + (briefing.optionsCount !== 1 ? 's' : '')
          : 'No options'}
      </div>
    </div>

    <!-- Market Regime -->
    <div class="cell">
      <div class="cell-label">MARKET</div>
      <div class="cell-val cell-regime" style="color:{regimeColor}">{briefing.marketRegime}</div>
      <div class="cell-sub">VIX {briefing.vixLevel}</div>
    </div>

    <!-- Top Mover -->
    <div class="cell">
      <div class="cell-label">TOP MOVER</div>
      {#if briefing.topMover}
        <div class="cell-val cell-mover" style="color:{moverColor}">
          {briefing.topMover.symbol} {pct(briefing.topMover.changePercent, 1)}
        </div>
        <div class="cell-sub">Today</div>
      {:else}
        <div class="cell-val" style="color:var(--muted)">—</div>
        <div class="cell-sub">No snapshot</div>
      {/if}
    </div>

  </div>

  <!-- ③ ALERTS STRIP -->
  {#if briefing.alerts.length > 0}
    <div class="alerts">
      <span class="alerts-hdr">Alerts:</span>
      {#each briefing.alerts as alert}
        <div class="chip">
          <div class="dot" style="background:{(dotColor as Record<string, string>)[alert.type] ?? 'var(--muted)'}"></div>
          <span>{alert.text}</span>
        </div>
      {/each}
    </div>
  {/if}

  <!-- ④ FOOTER -->
  <div class="footer">
    <span class="footer-time">
      {#if briefing.headlineGeneratedAt}
        Brief at {fmtTime(briefing.headlineGeneratedAt)} · Based on latest snapshot
      {:else}
        Based on latest broker snapshot
      {/if}
    </span>
    <form
      method="POST"
      action="?/generateBrief"
      use:enhance={() => {
        generating = true;
        return async ({ update }) => {
          await update();
          generating = false;
        };
      }}
    >
      <button type="submit" class="regen-btn" disabled={generating}>
        {generating ? 'Generating…' : '↻ Regenerate brief'}
      </button>
    </form>
  </div>

</div>

<style>
  .card {
    background: #0f1a12;
    border: 1px solid rgba(var(--success-rgb), 0.25);
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 14px;
  }

  /* ① Headline bar */
  .top {
    padding: 14px 18px 12px;
    border-bottom: 1px solid rgba(var(--success-rgb), 0.12);
  }
  .label-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 7px;
  }
  .label-text {
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--success);
  }
  .label-time {
    font-size: 0.6rem;
    color: var(--muted);
    background: rgba(var(--success-rgb), 0.1);
    padding: 1px 7px;
    border-radius: 10px;
  }
  .headline {
    font-size: 0.82rem;
    color: var(--text);
    line-height: 1.5;
    margin: 0;
  }
  .headline-empty {
    font-size: 0.78rem;
    color: var(--muted);
    margin: 0;
  }

  /* ② Data grid */
  .grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    border-top: 1px solid rgba(var(--success-rgb), 0.1);
  }
  .cell {
    padding: 10px 14px;
    border-right: 1px solid rgba(var(--success-rgb), 0.1);
  }
  .cell:last-child { border-right: none; }
  .cell-label {
    font-size: 0.55rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--muted);
    margin-bottom: 4px;
  }
  .cell-val {
    font-size: 0.88rem;
    font-weight: 700;
    line-height: 1.2;
  }
  .cell-regime { font-size: 0.76rem; }
  .cell-mover  { font-size: 0.76rem; }
  .cell-denom  { font-size: 0.62rem; font-weight: 400; color: var(--muted); }
  .cell-sub {
    font-size: 0.6rem;
    color: var(--muted);
    margin-top: 3px;
  }

  /* ③ Alerts strip */
  .alerts {
    padding: 8px 18px;
    border-top: 1px solid rgba(var(--success-rgb), 0.1);
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    background: rgba(0, 0, 0, 0.15);
  }
  .alerts-hdr {
    font-size: 0.58rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--muted);
    flex-shrink: 0;
  }
  .chip {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.65rem;
    color: var(--text);
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ④ Footer */
  .footer {
    padding: 7px 18px;
    border-top: 1px solid rgba(var(--success-rgb), 0.1);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .footer-time {
    font-size: 0.6rem;
    color: var(--muted);
  }
  .regen-btn {
    background: none;
    border: none;
    font-size: 0.65rem;
    color: var(--success);
    cursor: pointer;
    padding: 0;
    font-weight: 600;
    transition: opacity 0.15s;
  }
  .regen-btn:hover:not(:disabled) { opacity: 0.75; }
  .regen-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  /* Responsive */
  @media (max-width: 860px) {
    .grid { grid-template-columns: repeat(3, 1fr); }
    .cell { border-bottom: 1px solid rgba(var(--success-rgb), 0.1); }
    .cell:nth-child(3) { border-right: none; }
    .cell:nth-child(4) { border-bottom: none; }
    .cell:nth-child(5) { border-bottom: none; }
    .cell:nth-child(6) { border-right: none; border-bottom: none; }
  }
  @media (max-width: 600px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
    .cell:nth-child(2n) { border-right: none; }
    .cell:nth-child(3) { border-right: 1px solid rgba(var(--success-rgb), 0.1); border-bottom: 1px solid rgba(var(--success-rgb), 0.1); }
    .cell:nth-child(5) { border-right: 1px solid rgba(var(--success-rgb), 0.1); border-bottom: none; }
    .cell:nth-child(6) { border-bottom: none; }
    .alerts { gap: 8px; }
    .chip { font-size: 0.6rem; }
    .footer { flex-direction: column; align-items: flex-start; gap: 6px; }
  }
</style>
