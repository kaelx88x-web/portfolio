<!-- src/routes/optimization/behavioral/+page.svelte -->
<script lang="ts">
  import { ArrowLeft } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import BehavioralSummaryStrip from '$lib/components/optimization/BehavioralSummaryStrip.svelte';
  import BehavioralDimensionScores from '$lib/components/optimization/BehavioralDimensionScores.svelte';
  import BehavioralEvidence from '$lib/components/optimization/BehavioralEvidence.svelte';
  import BehavioralScenarioWeights from '$lib/components/optimization/BehavioralScenarioWeights.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<PageHeader
  title="Behavioral Investor Profile"
  subtitle="Ringkasan Behavioral — analisis gaya pelaburan sebenar kamu dari data."
  breadcrumb={[
    { label: 'Optimization', href: '/optimization' },
    { label: 'Behavioral Profile' }
  ]}
/>

<div class="actions-bar">
  <a class="tab-btn" href="/optimization">
    <ArrowLeft size={13} /> Back to Engine
  </a>
</div>

<BehavioralSummaryStrip
  statedProfile={data.profile.statedProfile}
  actualProfile={data.profile.actualProfile}
  confidencePct={data.profile.confidencePct}
  dataPoints={data.profile.dataPoints}
/>

<div class="two-col">
  <BehavioralDimensionScores dimensions={data.profile.dimensions} />
  <BehavioralEvidence evidence={data.profile.evidence} />
</div>

<BehavioralScenarioWeights weights={data.profile.weights} />

<style>
  .actions-bar {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }
  .tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--muted);
    background: var(--surface-1);
    border: 1px solid var(--border);
    text-decoration: none;
    transition: all 0.12s;
  }
  .tab-btn:hover { color: var(--text); border-color: var(--primary); }

  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }

  @media (max-width: 640px) {
    .two-col { grid-template-columns: 1fr; }
  }
</style>
