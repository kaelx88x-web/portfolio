<!-- src/lib/components/optimization/OptimizationModeSelector.svelte -->
<script lang="ts">
  export let portfolioModes: readonly string[] = [];
  export let optimizationGoals: readonly string[] = [];
  export let riskProfiles: readonly string[] = [];
  export let currentMode = 'hybrid';
  export let currentGoal = 'risk_parity';
  export let currentRisk = 'balanced';

  const modeLabel: Record<string, string> = {
    stock: 'Stocks Only',
    hybrid: 'Hybrid',
    options: 'Active Options'
  };
  const modeDesc: Record<string, string> = {
    stock: 'Buy and hold stocks. No options.',
    hybrid: 'Stocks + options income strategies.',
    options: 'Options-focused. Covered calls and puts.'
  };
  const modeIcon: Record<string, string> = {
    stock: '📦',
    hybrid: '⚡',
    options: '🎯'
  };
  const goalLabel: Record<string, string> = {
    minimum_volatility: 'Lower Risk',
    maximum_sharpe: 'Best Risk/Return',
    risk_parity: 'Balanced',
    efficient_frontier: 'Optimal Blend',
    target_volatility: 'Set Volatility Target',
    target_income: 'Income Focus',
    defensive_allocation: 'Defensive'
  };
  const riskLabel: Record<string, string> = {
    conservative: 'Safe',
    balanced: 'Moderate',
    aggressive: 'Aggressive'
  };
</script>

<form method="POST" action="?/run" class="selector">
  <div class="section-label">Portfolio Mode</div>
  <div class="mode-strip">
    {#each portfolioModes as mode}
      <label class="mode-card" class:active={mode === currentMode}>
        <input type="radio" name="portfolioMode" value={mode} checked={mode === currentMode} />
        <span class="m-icon">{modeIcon[mode] ?? '📂'}</span>
        <strong class="m-name">{modeLabel[mode] ?? mode}</strong>
        <span class="m-desc">{modeDesc[mode] ?? ''}</span>
      </label>
    {/each}
  </div>

  <div class="row-two">
    <div class="pill-group">
      <div class="section-label">Goal</div>
      <div class="pills">
        {#each optimizationGoals as goal}
          <label class="pill" class:active={goal === currentGoal}>
            <input type="radio" name="optimizationGoal" value={goal} checked={goal === currentGoal} />
            {goalLabel[goal] ?? goal}
          </label>
        {/each}
      </div>
    </div>
    <div class="pill-group">
      <div class="section-label">Risk Profile</div>
      <div class="pills">
        {#each riskProfiles as risk}
          <label class="pill" class:active={risk === currentRisk}>
            <input type="radio" name="riskProfile" value={risk} checked={risk === currentRisk} />
            {riskLabel[risk] ?? risk}
          </label>
        {/each}
      </div>
    </div>
  </div>

  <button class="button run-btn" type="submit">Run Optimization</button>
</form>

<style>
  .selector { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 16px; display: grid; gap: 14px; margin-bottom: 16px; }
  .section-label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; margin-bottom: 6px; }

  /* Mode cards */
  .mode-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .mode-card { display: flex; flex-direction: column; gap: 4px; border: 1.5px solid var(--border); border-radius: 10px; padding: 12px 14px; cursor: pointer; background: var(--bg); transition: border-color 0.12s; }
  .mode-card input { display: none; }
  .mode-card.active { border-color: var(--primary); background: rgba(var(--primary-rgb), 0.05); }
  .mode-card:has(input:checked) { border-color: var(--primary); background: rgba(var(--primary-rgb), 0.05); }
  .m-icon { font-size: 1.2rem; }
  .m-name { font-size: 0.82rem; font-weight: 800; color: var(--text); }
  .mode-card.active .m-name { color: var(--primary); }
  .mode-card:has(input:checked) .m-name { color: var(--primary); }
  .m-desc { font-size: 0.67rem; color: var(--muted); line-height: 1.4; }

  /* Goal + Risk pills */
  .row-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .pills { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill { border: 1px solid var(--border); border-radius: 999px; padding: 6px 13px; font-size: 0.72rem; font-weight: 600; cursor: pointer; color: var(--muted); background: var(--bg); transition: all 0.12s; white-space: nowrap; }
  .pill input { display: none; }
  .pill.active { background: var(--primary); color: #fff; border-color: var(--primary); }
  .pill:has(input:checked) { background: var(--primary); color: #fff; border-color: var(--primary); }

  .run-btn { justify-self: end; }

  @media (max-width: 900px) {
    .mode-strip { grid-template-columns: 1fr; }
    .row-two { grid-template-columns: 1fr; }
    .run-btn { justify-self: stretch; }
  }
</style>
