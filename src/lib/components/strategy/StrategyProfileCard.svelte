<script lang="ts">
  import PortfolioModeBadge from './PortfolioModeBadge.svelte';
  import type { PortfolioStrategyProfile } from '$lib/services/strategy-orchestrator.service';

  export let profile: PortfolioStrategyProfile;
</script>

<article class="profile">
  <div class="head">
    <div>
      <span>Current Portfolio Strategy</span>
      <h2>Strategy Profile</h2>
    </div>
    <PortfolioModeBadge mode={profile.profileType} />
  </div>
  <div class="grid">
    <div><span>Risk Profile</span><strong>{profile.riskTolerance.toFixed(0)}/100</strong></div>
    <div><span>Income Target</span><strong>{profile.incomeTarget.toFixed(1)}%</strong></div>
    <div><span>Growth Target</span><strong>{profile.growthTarget.toFixed(1)}%</strong></div>
    <div><span>Cash Target</span><strong>{profile.cashTarget.toFixed(1)}%</strong></div>
    <div><span>Options Target</span><strong>{profile.optionsTarget.toFixed(1)}%</strong></div>
  </div>
  {#if profile.metadata.guardrail}<p>{profile.metadata.guardrail}</p>{/if}
</article>

<style>
  .profile { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 12px; }
  .head { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
  .head span, .grid span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  h2 { margin: 3px 0 0; color: var(--text); font-size: 0.95rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
  .grid div { border: 1px solid var(--border); border-radius: 8px; background: var(--surface-1); padding: 10px; display: grid; gap: 5px; min-width: 0; }
  .grid strong { color: var(--text); font-size: 0.9rem; }
  p { margin: 0; color: var(--muted); font-size: 0.72rem; line-height: 1.5; }
</style>
