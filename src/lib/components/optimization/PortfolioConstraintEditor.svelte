<script lang="ts">
  import type { OptimizationConstraintSet } from '$lib/services/optimization-engine.service';

  export let constraints: OptimizationConstraintSet;
</script>

<form method="POST" action="?/saveConstraints" class="editor">
  <h2>Constraints</h2>
  <label>Single stock max % <input name="singleStockMaxPct" type="number" step="1" min="1" max="80" value={constraints.singleStockMaxPct} /></label>
  <label>Options max % <input name="optionsMaxPct" type="number" step="1" min="0" max="100" value={constraints.optionsMaxPct} /></label>
  <label>Hybrid — stock % <input name="hybridStockPct" type="number" step="1" min="0" max="100" value={constraints.hybridStockPct} /></label>
  <label>Cash minimum % <input name="cashMinPct" type="number" step="1" min="0" max="60" value={constraints.cashMinPct} /></label>
  <label>Sector max % <input name="sectorMaxPct" type="number" step="1" min="5" max="90" value={constraints.sectorMaxPct} /></label>
  <label>Collateral reserve % <input name="collateralReservePct" type="number" step="1" min="0" max="100" value={constraints.collateralReservePct} /></label>
  <label>Target volatility % <input name="targetVolatilityPct" type="number" step="1" min="1" max="120" value={constraints.targetVolatilityPct} /></label>
  <button class="button" type="submit">Save Constraints</button>
</form>

<style>
  .editor { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 10px; }
  h2 { margin: 0; color: var(--text); font-size: 0.9rem; }
  label { display: grid; gap: 4px; color: var(--muted); font-size: 0.68rem; font-weight: 700; text-transform: uppercase; }
  input { width: 100%; height: 32px; box-sizing: border-box; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); padding: 0 8px; }
  button { margin-top: 4px; }
</style>
