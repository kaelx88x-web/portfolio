<script lang="ts">
  import { Play } from 'lucide-svelte';
  import { ChevronDown } from 'lucide-svelte';
  import type { ScenarioType } from '$lib/services/scenario-simulation.service';
  import type { PortfolioMode } from '$lib/services/optimization-engine.service';

  export let scenarioTypes: readonly ScenarioType[] = [];
  export let portfolioModes: readonly PortfolioMode[] = [];
  export let activeScenario: ScenarioType = 'bear_market';
  export let activeMode: PortfolioMode = 'hybrid';

  let scenarioOpen = false;
  let modeOpen = false;
  let selectedScenario: ScenarioType = activeScenario;
  let selectedMode: PortfolioMode = activeMode;

  function label(value: string) {
    return value.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
  }

  function selectScenario(value: ScenarioType) {
    selectedScenario = value;
    scenarioOpen = false;
  }

  function selectMode(value: PortfolioMode) {
    selectedMode = value;
    modeOpen = false;
  }

  function clickOutside(node: HTMLElement) {
    const handle = (e: MouseEvent) => { if (!node.contains(e.target as Node)) { scenarioOpen = false; modeOpen = false; } };
    document.addEventListener('click', handle, true);
    return { destroy() { document.removeEventListener('click', handle, true); } };
  }
</script>

<form method="POST" action="?/run" class="selector" use:clickOutside>
  <!-- hidden inputs carry the selected values -->
  <input type="hidden" name="scenarioType" value={selectedScenario} />
  <input type="hidden" name="portfolioMode" value={selectedMode} />

  <div class="field">
    <span>Scenario</span>
    <div class="drop" class:open={scenarioOpen}>
      <button type="button" class="drop-trigger" on:click={() => { scenarioOpen = !scenarioOpen; modeOpen = false; }}>
        <span>{label(selectedScenario)}</span>
        <ChevronDown size={14} />
      </button>
      {#if scenarioOpen}
        <div class="drop-menu">
          {#each scenarioTypes as scenario}
            <button type="button" class="drop-item" class:active={scenario === selectedScenario} on:click={() => selectScenario(scenario)}>
              {label(scenario)}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <div class="field">
    <span>Mode</span>
    <div class="drop" class:open={modeOpen}>
      <button type="button" class="drop-trigger" on:click={() => { modeOpen = !modeOpen; scenarioOpen = false; }}>
        <span>{label(selectedMode)}</span>
        <ChevronDown size={14} />
      </button>
      {#if modeOpen}
        <div class="drop-menu">
          {#each portfolioModes as mode}
            <button type="button" class="drop-item" class:active={mode === selectedMode} on:click={() => selectMode(mode)}>
              {label(mode)}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <button class="button run-btn" type="submit"><Play size={14} /> Run Simulation</button>
</form>

<style>
  .selector { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 12px; display: flex; flex-wrap: wrap; gap: 10px; align-items: end; margin-bottom: 12px; }

  .field { display: grid; gap: 5px; min-width: min(14rem, 100%); }
  .field > span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }

  .drop { position: relative; }
  .drop-trigger { width: 100%; height: 34px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-1); color: var(--text); padding: 0 10px; font-size: 0.78rem; cursor: pointer; transition: border-color 0.12s; }
  .drop-trigger:hover, .drop.open .drop-trigger { border-color: var(--primary); }
  .drop-trigger span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .drop-menu { position: absolute; top: calc(100% + 4px); left: 0; min-width: 100%; z-index: 50; border: 1px solid var(--border); border-radius: 8px; background: var(--card); box-shadow: 0 8px 24px rgba(0,0,0,0.35); overflow: hidden; }
  .drop-item { width: 100%; display: block; text-align: left; padding: 8px 12px; font-size: 0.78rem; color: var(--muted); background: transparent; border: none; cursor: pointer; transition: background 0.1s, color 0.1s; }
  .drop-item:hover { background: var(--surface-1); color: var(--text); }
  .drop-item.active { color: var(--primary); font-weight: 700; background: rgba(var(--primary-rgb), 0.08); }

  .run-btn { height: 34px; }
  @media (max-width: 600px) { .field { min-width: 100%; } }
</style>
