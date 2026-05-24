<script lang="ts">
  import type { OptimizationScenario } from '$lib/services/optimization-engine.service';

  export let scenarios: OptimizationScenario[] = [];
  export let active = scenarios[0]?.scenarioName ?? '';
</script>

<div class="tabs">
  {#each scenarios as scenario}
    {@const isActive = scenario.scenarioName === active}
    <a
      class="tab"
      class:active={isActive}
      href={`?scenario=${encodeURIComponent(scenario.scenarioName)}`}
    >
      <span class="name">{scenario.scenarioName}</span>
      <span class="ret" class:pos={scenario.expectedReturn > 0} class:neg={scenario.expectedReturn < 0}>
        {scenario.expectedReturn > 0 ? '+' : ''}{scenario.expectedReturn.toFixed(1)}%
      </span>
    </a>
  {/each}
</div>

<style>
  .tabs { display: flex; flex-wrap: wrap; gap: 6px; }
  .tab {
    display: inline-flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--card);
    text-decoration: none;
    transition: border-color 0.12s, background 0.12s;
    min-width: 100px;
  }
  .tab:hover { border-color: var(--primary); }
  .tab.active {
    border-color: var(--primary);
    background: rgba(var(--primary-rgb), 0.08);
  }
  .name {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--text);
    text-transform: capitalize;
  }
  .ret {
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--muted);
  }
  .ret.pos { color: var(--success); }
  .ret.neg { color: var(--danger); }
</style>
