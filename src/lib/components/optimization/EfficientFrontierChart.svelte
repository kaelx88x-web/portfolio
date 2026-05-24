<script lang="ts">
  export let points: Array<{ risk: number; expectedReturn: number; label: string }> = [];

  $: maxRisk = Math.max(1, ...points.map((p) => p.risk));
  $: maxReturn = Math.max(1, ...points.map((p) => p.expectedReturn));
  $: minReturn = Math.min(0, ...points.map((p) => p.expectedReturn));
  $: returnRange = maxReturn - minReturn || 1;
</script>

<article class="card">
  <div class="head">
    <div>
      <span class="label">Efficient Frontier</span>
      <p class="sub">Risk vs expected return for each scenario</p>
    </div>
    <div class="legend">
      <span class="dot-legend"></span>Scenario
    </div>
  </div>

  <div class="plot-wrap">
    <div class="y-axis">
      <span>{maxReturn.toFixed(1)}%</span>
      <span>Return</span>
      <span>{minReturn.toFixed(1)}%</span>
    </div>
    <div class="plot">
      {#each points as point}
        {@const x = (point.risk / maxRisk) * 88}
        {@const y = ((point.expectedReturn - minReturn) / returnRange) * 82}
        <div
          class="dot"
          style="left:{x}%; bottom:{y}%"
          title="{point.label}: {point.expectedReturn.toFixed(2)}% return / {point.risk.toFixed(2)}% risk"
        >
          <span class="dot-label">{point.label}</span>
        </div>
      {/each}
    </div>
    <div class="x-axis">
      <span>0%</span>
      <span>Risk (volatility) →</span>
      <span>{maxRisk.toFixed(1)}%</span>
    </div>
  </div>
</article>

<style>
  .card { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 16px; display: grid; gap: 14px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; }
  .sub { margin: 3px 0 0; font-size: 0.68rem; color: var(--muted); }
  .legend { display: flex; align-items: center; gap: 5px; font-size: 0.65rem; color: var(--muted); }
  .dot-legend { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--primary); box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.2); }

  .plot-wrap { display: grid; grid-template-rows: 1fr auto; grid-template-columns: 2.5rem 1fr; gap: 4px; }
  .y-axis {
    grid-row: 1; grid-column: 1;
    display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end;
    padding-right: 6px; padding-bottom: 4px;
    font-size: 0.6rem; color: var(--muted);
  }
  .y-axis span:nth-child(2) { writing-mode: vertical-rl; transform: rotate(180deg); letter-spacing: 0.04em; opacity: 0.5; font-size: 0.55rem; text-transform: uppercase; font-weight: 700; }
  .plot {
    grid-row: 1; grid-column: 2;
    position: relative; height: 220px;
    border-left: 1px solid var(--border); border-bottom: 1px solid var(--border);
    background: repeating-linear-gradient(0deg, transparent, transparent 43px, rgba(var(--border-rgb, 255 255 255), 0.03) 44px),
                repeating-linear-gradient(90deg, transparent, transparent 43px, rgba(var(--border-rgb, 255 255 255), 0.03) 44px),
                linear-gradient(180deg, rgba(var(--primary-rgb), 0.03), transparent);
    overflow: visible;
  }
  .x-axis {
    grid-row: 2; grid-column: 2;
    display: flex; justify-content: space-between;
    font-size: 0.6rem; color: var(--muted); padding-top: 4px;
  }
  .x-axis span:nth-child(2) { opacity: 0.5; font-size: 0.55rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.04em; }

  .dot {
    position: absolute;
    width: 12px; height: 12px;
    border-radius: 50%;
    background: var(--primary);
    box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.15), 0 2px 6px rgba(0,0,0,0.2);
    transform: translate(-50%, 50%);
    cursor: default;
    transition: box-shadow 0.15s;
  }
  .dot:hover { box-shadow: 0 0 0 6px rgba(var(--primary-rgb), 0.25), 0 2px 8px rgba(0,0,0,0.3); }
  .dot-label {
    position: absolute;
    left: 16px; top: -6px;
    white-space: nowrap;
    font-size: 0.65rem; font-weight: 700;
    color: var(--text);
    background: var(--card);
    padding: 1px 5px;
    border-radius: 4px;
    border: 1px solid var(--border);
    pointer-events: none;
  }
</style>
