<script lang="ts">
  export let usagePct = 0;
  export let collateral = 0;

  const money = (n: number) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  $: level = usagePct >= 90 ? 'high' : usagePct >= 70 ? 'medium' : 'low';
  $: barColor = level === 'high' ? 'var(--danger)' : level === 'medium' ? 'var(--warning)' : 'var(--success)';
</script>

<article class="card">
  <div class="top">
    <div>
      <div class="label">Collateral Usage</div>
      <div class="pct" style="color:{barColor}">{usagePct.toFixed(1)}<span>%</span></div>
    </div>
    <div class="locked">
      <div class="locked-val">{money(collateral)}</div>
      <div class="locked-lbl">locked</div>
    </div>
  </div>

  <div class="bar-track">
    <div class="bar-fill" style="width:{Math.min(100, usagePct)}%; background:{barColor}"></div>
    <div class="bar-mark"></div>
  </div>

  <div class="footer">
    <span>0%</span>
    <span class="warn-label">⚠ 90% safety line</span>
    <span>100%</span>
  </div>
</article>

<style>
  .card { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 16px; display: grid; gap: 10px; }

  .top { display: flex; justify-content: space-between; align-items: flex-start; }
  .label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; margin-bottom: 4px; }
  .pct { font-size: 1.8rem; font-weight: 800; line-height: 1; }
  .pct span { font-size: 0.9rem; font-weight: 600; color: var(--muted); }
  .locked { text-align: right; }
  .locked-val { font-size: 0.82rem; font-weight: 700; color: var(--text); }
  .locked-lbl { font-size: 0.62rem; color: var(--muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; }

  .bar-track { height: 8px; border-radius: 999px; background: var(--surface-1); position: relative; }
  .bar-fill { height: 100%; border-radius: 999px; transition: width 0.5s ease; }
  .bar-mark { position: absolute; top: -3px; left: 90%; height: 14px; width: 2px; background: rgba(var(--danger-rgb), 0.5); border-radius: 1px; }

  .footer { display: flex; justify-content: space-between; font-size: 0.62rem; color: var(--muted); }
  .warn-label { color: var(--danger); font-weight: 700; }
</style>
