<script lang="ts">
  import type { WheelStrategyReport } from '$lib/services/options-intelligence.service';
  export let report: WheelStrategyReport;

  const statusLabel: Record<string, string> = {
    cash_secured_put: 'Cash-Secured Put',
    covered_call: 'Covered Call',
    ready_for_put: 'Ready for Put',
    monitor: 'Monitor'
  };
  const statusColor: Record<string, string> = {
    cash_secured_put: 'var(--primary)',
    covered_call: 'var(--success)',
    ready_for_put: 'var(--warning)',
    monitor: 'var(--muted)'
  };
  const money = (n: number) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  $: sc = statusColor[report.strategy_status] ?? 'var(--muted)';
  $: sym = report.symbol.replace(/^US\./, '');
</script>

<article class="card">
  <div class="head">
    <span class="sym">{sym}</span>
    <span class="status" style="--sc:{sc}">{statusLabel[report.strategy_status] ?? report.strategy_status}</span>
  </div>

  <p class="step">{report.next_step}</p>

  <div class="stats">
    <div class="stat">
      <span>Premium</span>
      <strong class="green">{money(report.premium_collected)}</strong>
    </div>
    <div class="stat">
      <span>Assignment</span>
      <strong class={report.assignment_probability > 0.6 ? 'red' : report.assignment_probability > 0.3 ? 'amber' : ''}>
        {(report.assignment_probability * 100).toFixed(0)}%
      </strong>
    </div>
    <div class="stat">
      <span>Efficiency</span>
      <strong>{report.collateral_efficiency}/100</strong>
    </div>
  </div>
</article>

<style>
  .card { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 14px; display: grid; gap: 10px; }

  .head { display: flex; justify-content: space-between; align-items: center; }
  .sym { font-size: 0.88rem; font-weight: 800; color: var(--text); }
  .status { font-size: 0.62rem; font-weight: 800; letter-spacing: 0.06em; padding: 3px 9px; border-radius: 999px; background: rgba(from var(--sc) r g b / 0.12); color: var(--sc); border: 1px solid rgba(from var(--sc) r g b / 0.25); }

  .step { margin: 0; font-size: 0.72rem; color: var(--muted); line-height: 1.5; }

  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; border-top: 1px solid var(--border); padding-top: 10px; }
  .stat span { font-size: 0.6rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em; }
  .stat strong { display: block; margin-top: 3px; font-size: 0.8rem; color: var(--text); }
  .green { color: var(--success) !important; }
  .amber { color: var(--warning) !important; }
  .red { color: var(--danger) !important; }
</style>
