<script lang="ts">
  export let stressTest: {
    scenarios: Array<{ scenarioName: string; projectedDrawdown: number; projectedVolatility: number; riskSummary: { risk_level: string } }>;
    ai_explanation: string;
    guardrail: string;
  };
</script>

<article class="chart-card">
  <div class="head">
    <div>
      <span>Stress Test Result</span>
      <h2>Scenario Drawdown</h2>
    </div>
    <strong>{stressTest.scenarios.length} cases</strong>
  </div>
  <div class="rows">
    {#each stressTest.scenarios as scenario}
      {@const width = Math.min(100, Math.abs(scenario.projectedDrawdown) * 3)}
      <div class="row">
        <div class="meta">
          <span>{scenario.scenarioName}</span>
          <strong>{scenario.projectedDrawdown.toFixed(2)}%</strong>
        </div>
        <i><b class:high={scenario.riskSummary.risk_level === 'high'} class:medium={scenario.riskSummary.risk_level === 'medium'} style={`width:${width}%`}></b></i>
      </div>
    {/each}
  </div>
  <p>{stressTest.ai_explanation}</p>
  <div class="guardrail">{stressTest.guardrail}</div>
</article>

<style>
  .chart-card { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 12px; }
  .head { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
  .head span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  h2 { margin: 3px 0 0; color: var(--text); font-size: 0.95rem; }
  .head strong { color: var(--primary); font-size: 0.76rem; }
  .rows { display: grid; gap: 10px; }
  .meta { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 5px; font-size: 0.72rem; }
  .meta span { color: var(--muted); }
  .meta strong { color: var(--text); }
  i { display: block; height: 8px; border-radius: 999px; overflow: hidden; background: var(--surface-1); }
  b { display: block; height: 100%; border-radius: inherit; background: var(--success); }
  b.medium { background: var(--warning); }
  b.high { background: var(--danger); }
  p { margin: 0; color: var(--muted); font-size: 0.74rem; line-height: 1.5; }
  .guardrail { color: var(--muted); font-size: 0.68rem; }
</style>
