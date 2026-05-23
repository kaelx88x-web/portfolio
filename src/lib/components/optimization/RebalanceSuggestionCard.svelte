<script lang="ts">
  import { ShieldCheck, ChevronDown, ChevronUp } from 'lucide-svelte';
  import type { RebalanceSuggestion } from '$lib/services/optimization-engine.service';

  export let suggestion: RebalanceSuggestion;

  const isHybrid  = suggestion.metadata?.source === 'hybrid-mode'  || suggestion.metadata?.mode === 'hybrid';
  const isOptions = suggestion.metadata?.source === 'options-mode' || suggestion.metadata?.mode === 'options';
  const hideAllocation = isHybrid || isOptions;

  const riskLevel: 'safe' | 'watch' | 'risk' = suggestion.metadata?.riskLevel ?? 'safe';
  const safetyLabel = { safe: 'Safe', watch: 'Watch', risk: 'At Risk' };

  $: actions = hideAllocation ? [] : suggestion.targetAllocation
    .filter(r => Math.abs(r.deltaPct) >= 0.5)
    .filter(r => !(r.role === 'options' && r.deltaPct < 0))
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
    .slice(0, 6)
    .map(r => ({
      label:      r.label.replace(/^(US|HK)\./, ''),
      delta:      r.deltaPct,
      currentPct: r.currentPct,
      action:     r.currentPct < 0.05 ? 'ADD' : r.deltaPct > 0 ? 'INCREASE' : 'REDUCE',
      ticketType: r.deltaPct > 0 || r.currentPct < 0.05 ? 'buy' : 'sell',
    }));

  // Accent color: red-leaning if mostly reduces, green if mostly adds
  $: accentType = actions.length === 0
    ? 'neutral'
    : actions.filter(a => a.action === 'REDUCE').length > actions.length / 2
      ? 'reduce'
      : 'add';

  function tradeUrl(a: typeof actions[0]) {
    const params = new URLSearchParams({
      symbol:     a.label,
      ticketType: a.ticketType,
      thesis:     suggestion.title + ' — ' + suggestion.summary.slice(0, 120),
      sourceType: 'rebalance',
    });
    return `/trades?${params.toString()}`;
  }

  let expanded = false;
</script>

<article class="card accent-{accentType}" class:hybrid={isHybrid}>
  <!-- Header -->
  <div class="card-head">
    <div class="title-row">
      <ShieldCheck size={14} class="shield" />
      <h2>{suggestion.title}</h2>
    </div>
    {#if isHybrid}
      <span class="safety {riskLevel}">{safetyLabel[riskLevel]}</span>
    {/if}
  </div>

  <p class="summary">{suggestion.summary}</p>

  <!-- Action rows -->
  {#if !hideAllocation && actions.length > 0}
    <div class="actions-box">
      <div class="actions-head">What to do</div>
      {#each actions as a}
        <div class="action-row">
          <span class="badge badge-{a.action.toLowerCase()}">{a.action}</span>
          <span class="sym">{a.label}</span>
          <span class="cur">{a.currentPct.toFixed(1)}% now</span>
          <span class="delta" class:pos={a.delta > 0} class:neg={a.delta < 0}>
            {a.delta > 0 ? '+' : ''}{a.delta.toFixed(1)}%
          </span>
        </div>
      {/each}
    </div>

    <div class="trade-row">
      {#each actions.slice(0, 3) as a}
        <a class="trade-btn" href={tradeUrl(a)}>
          {a.action === 'REDUCE' ? '↓ Sell' : '↑ Buy'} {a.label}
        </a>
      {/each}
    </div>
  {/if}

  <!-- Expandable details -->
  <div class="footer-row">
    <small class="disclaimer">Review only — no trade is placed automatically.</small>
    <button class="toggle" type="button" on:click={() => (expanded = !expanded)}>
      {expanded ? 'Hide' : 'Why this?'}
      {#if expanded}<ChevronUp size={12} />{:else}<ChevronDown size={12} />{/if}
    </button>
  </div>

  {#if expanded}
    <div class="impact">
      <p>{suggestion.riskImpact}</p>
      {#if suggestion.volatilityImpact !== suggestion.riskImpact}
        <p>{suggestion.volatilityImpact}</p>
      {/if}
    </div>
  {/if}
</article>

<style>
  /* ── Card shell ───────────────────────────────────────────────────── */
  .card {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--card);
    padding: 14px 16px;
    display: grid;
    gap: 10px;
    border-left-width: 3px;
  }
  .accent-add    { border-left-color: var(--success); }
  .accent-reduce { border-left-color: var(--danger);  }
  .accent-neutral{ border-left-color: var(--primary); }

  /* ── Header ───────────────────────────────────────────────────────── */
  .card-head   { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .title-row   { display: flex; align-items: flex-start; gap: 8px; flex: 1; min-width: 0; }
  :global(.shield) { color: var(--primary); flex-shrink: 0; margin-top: 1px; }
  h2 { margin: 0; color: var(--text); font-size: 0.86rem; font-weight: 700; line-height: 1.35; }

  .safety {
    flex-shrink: 0; font-size: 0.59rem; font-weight: 800;
    padding: 3px 8px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.04em;
  }
  .safety.safe  { background: rgba(var(--success-rgb),.12); color: var(--success); border: 1px solid rgba(var(--success-rgb),.3); }
  .safety.watch { background: rgba(var(--warning-rgb),.12); color: var(--warning); border: 1px solid rgba(var(--warning-rgb),.3); }
  .safety.risk  { background: rgba(var(--danger-rgb), .12); color: var(--danger);  border: 1px solid rgba(var(--danger-rgb), .3); }

  /* ── Summary ──────────────────────────────────────────────────────── */
  .summary { margin: 0; color: var(--muted); font-size: 0.74rem; line-height: 1.55; }

  /* ── Actions box ──────────────────────────────────────────────────── */
  .actions-box {
    display: grid; gap: 6px;
    border: 1px solid var(--border); border-radius: 7px;
    padding: 10px 12px; background: var(--bg);
  }
  .actions-head { font-size: 0.59rem; font-weight: 800; text-transform: uppercase; color: var(--muted); margin-bottom: 2px; }
  .action-row   { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 8px; }

  .badge {
    font-size: 0.57rem; font-weight: 800; padding: 2px 7px;
    border-radius: 4px; text-transform: uppercase; letter-spacing: 0.03em;
  }
  .badge-add      { background: rgba(var(--success-rgb),.12); color: var(--success); }
  .badge-increase { background: rgba(var(--primary-rgb),.1);  color: var(--primary); }
  .badge-reduce   { background: rgba(var(--danger-rgb), .1);  color: var(--danger);  }

  .sym   { color: var(--text); font-size: 0.74rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cur   { color: var(--muted); font-size: 0.66rem; white-space: nowrap; }
  .delta { font-size: 0.72rem; font-weight: 700; color: var(--muted); white-space: nowrap; }
  .delta.pos { color: var(--success); }
  .delta.neg { color: var(--danger);  }

  /* ── Trade buttons ────────────────────────────────────────────────── */
  .trade-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .trade-btn {
    font-size: 0.68rem; font-weight: 700; white-space: nowrap;
    color: var(--primary); background: rgba(var(--primary-rgb),.08);
    border: 1px solid rgba(var(--primary-rgb),.25); border-radius: 5px;
    padding: 4px 10px; text-decoration: none; transition: background 0.12s;
  }
  .trade-btn:hover { background: rgba(var(--primary-rgb),.18); }

  /* ── Footer row ───────────────────────────────────────────────────── */
  .footer-row  { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .disclaimer  { color: var(--warning); font-size: 0.64rem; }
  .toggle {
    display: inline-flex; align-items: center; gap: 4px;
    background: none; border: none; cursor: pointer;
    color: var(--muted); font-size: 0.65rem; font-weight: 700;
    padding: 0; transition: color 0.12s;
  }
  .toggle:hover { color: var(--text); }

  /* ── Expanded impact ──────────────────────────────────────────────── */
  .impact {
    display: grid; gap: 6px;
    border-left: 2px solid var(--border); padding-left: 12px;
  }
  .impact p { margin: 0; color: var(--muted); font-size: 0.72rem; line-height: 1.55; }
</style>
