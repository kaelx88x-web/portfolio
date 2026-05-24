<script lang="ts">
  import RiskToleranceSlider from './RiskToleranceSlider.svelte';
  import type { PortfolioStrategyProfile } from '$lib/services/strategy-orchestrator.service';

  export let profile: PortfolioStrategyProfile;

  let riskTolerance = profile.riskTolerance;
</script>

<form method="POST" action="?/updateProfile" class="panel">
  <h2>Portfolio Objectives</h2>
  <input type="hidden" name="profileType" value={profile.profileType} />
  <RiskToleranceSlider bind:value={riskTolerance} />
  <div class="inputs">
    <label><span>Income Target</span><input name="incomeTarget" type="number" min="0" max="40" step="0.5" value={profile.incomeTarget} /></label>
    <label><span>Growth Target</span><input name="growthTarget" type="number" min="0" max="40" step="0.5" value={profile.growthTarget} /></label>
    <label><span>Cash Target</span><input name="cashTarget" type="number" min="0" max="60" step="0.5" value={profile.cashTarget} /></label>
    <label><span>Options Target</span><input name="optionsTarget" type="number" min="0" max="60" step="0.5" value={profile.optionsTarget} /></label>
  </div>
  <button class="button" type="submit">Save Objectives</button>
</form>

<style>
  .panel { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 12px; }
  h2 { margin: 0; color: var(--text); font-size: 0.95rem; }
  .inputs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  label { display: grid; gap: 5px; }
  span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  input { height: 34px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-1); color: var(--text); padding: 0 10px; font-size: 0.78rem; min-width: 0; }
  @media (max-width: 720px) { .inputs { grid-template-columns: 1fr; } }
</style>
