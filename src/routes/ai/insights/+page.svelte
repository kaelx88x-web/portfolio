<script lang="ts">
  import { Sparkles } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AiDisclaimerBox from '$lib/components/ai/AiDisclaimerBox.svelte';
  import AiInsightHistory from '$lib/components/ai/AiInsightHistory.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<div class="page-top">
  <PageHeader
    title="AI Insights"
    subtitle="Saved advisory summaries generated from your current portfolio context."
    breadcrumb={[{ label: 'AI', href: '/ai' }, { label: 'Insights' }]}
  />
  <a class="button" href="/ai/copilot">Open Copilot</a>
</div>

<div class="top-grid">
  <div class="card gen-card">
    <div class="gen-header">
      <Sparkles size={15} style="color:#6c8fff" />
      <span class="gen-title">Generate New Insight</span>
    </div>
    <form method="POST" action="?/generate" class="gen-form">
      <button class="button-secondary gen-btn" name="insightType" value="portfolio_health">Portfolio Health</button>
      <button class="button-secondary gen-btn" name="insightType" value="risk_analysis">Risk Analysis</button>
      <button class="button-secondary gen-btn" name="insightType" value="allocation_review">Allocation</button>
      <button class="button-secondary gen-btn" name="insightType" value="performance_summary">Performance</button>
      <button class="button-secondary gen-btn" name="insightType" value="market_commentary">Market</button>
    </form>
  </div>
  <AiDisclaimerBox />
</div>

<AiInsightHistory insights={data.insights} />

<style>
  .page-top  { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }

  .top-grid  { display: grid; grid-template-columns: 1fr 0.75fr; gap: 12px; margin-bottom: 16px; }
  @media (max-width: 900px) { .top-grid { grid-template-columns: 1fr; } }

  .gen-card   { padding: 18px; }
  .gen-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
  .gen-title  { font-size: 0.85rem; font-weight: 700; color: #dce8ff; }
  .gen-form   { display: flex; flex-wrap: wrap; gap: 8px; }
  .gen-btn    { font-size: 0.72rem; height: 32px; padding: 0 12px; }
</style>
