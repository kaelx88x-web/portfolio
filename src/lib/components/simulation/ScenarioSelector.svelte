<script lang="ts">
  import { Play } from 'lucide-svelte';
  import type { ScenarioType } from '$lib/services/scenario-simulation.service';
  import type { PortfolioMode } from '$lib/services/optimization-engine.service';

  export let scenarioTypes: readonly ScenarioType[] = [];
  export let portfolioModes: readonly PortfolioMode[] = [];
  export let activeScenario: ScenarioType = 'bear_market';
  export let activeMode: PortfolioMode = 'hybrid';

  function label(value: string) {
    return value.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
  }
</script>

<form method="POST" action="?/run" class="selector">
  <label>
    <span>Scenario</span>
    <select name="scenarioType">
      {#each scenarioTypes as scenario}
        <option value={scenario} selected={scenario === activeScenario}>{label(scenario)}</option>
      {/each}
    </select>
  </label>
  <label>
    <span>Mode</span>
    <select name="portfolioMode">
      {#each portfolioModes as mode}
        <option value={mode} selected={mode === activeMode}>{label(mode)}</option>
      {/each}
    </select>
  </label>
  <button class="button" type="submit"><Play size={15} /> Run Simulation</button>
</form>

<style>
  .selector { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 12px; display: flex; flex-wrap: wrap; gap: 10px; align-items: end; margin-bottom: 12px; }
  label { display: grid; gap: 5px; min-width: min(14rem, 100%); }
  span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  select { height: 34px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-1); color: var(--text); padding: 0 10px; font-size: 0.78rem; }
  select option { background: var(--card); color: var(--text); }
  button { height: 34px; }
</style>
