<script lang="ts">
  import { Bot, BrainCircuit, DatabaseZap, FileText, History, MessageSquareText, Route, ShieldAlert, Sliders, Sparkles } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AiDisclaimerBox from '$lib/components/ai/AiDisclaimerBox.svelte';
  import AiInsightHistory from '$lib/components/ai/AiInsightHistory.svelte';
  import AiPortfolioSummaryCard from '$lib/components/ai/AiPortfolioSummaryCard.svelte';
  import AiSuggestionChips from '$lib/components/ai/AiSuggestionChips.svelte';
  import AiUsageMeter from '$lib/components/ai/AiUsageMeter.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<div class="page-top">
  <PageHeader
    title="AI Copilot"
    subtitle="Advisory portfolio assistant connected to your live portfolio context."
  />
  <div class="page-actions">
    <a class="button" href="/ai/copilot"><Bot size={15} /> Open Chat</a>
    <a class="button-secondary" href="/ai/insights"><Sparkles size={15} /> Insights</a>
    <a class="button-secondary" href="/ai/conversations"><History size={15} /> Conversations</a>
    <a class="button-secondary" href="/ai/portfolio-assistant"><MessageSquareText size={15} /> Assistant</a>
    <a class="button-secondary" href="/ai/risk-advisor"><ShieldAlert size={15} /> Risk Advisor</a>
    <a class="button-secondary" href="/optimization"><Sliders size={15} /> Optimization</a>
    <a class="button-secondary" href="/ai/orchestrator"><Route size={15} /> Orchestrator</a>
    <a class="button-secondary" href="/ai/prompts"><FileText size={15} /> Prompts</a>
    <a class="button-secondary" href="/ai/memory"><DatabaseZap size={15} /> Memory</a>
  </div>
</div>

<!-- Context + disclaimer -->
<div class="top-grid">
  <AiPortfolioSummaryCard context={data.context} />
  <AiDisclaimerBox />
</div>

<!-- Suggestions + Usage + Generate + History -->
<div class="main-grid">
  <div class="left-col">
    <div class="card section-card">
      <div class="section-header">
        <BrainCircuit size={16} style="color:#6c8fff" />
        <span class="section-title">Suggested Questions</span>
      </div>
      <AiSuggestionChips suggestions={data.suggestions} />
    </div>
    <AiUsageMeter usage={data.usage} />
  </div>

  <div class="right-col">
    <div class="card section-card">
      <div class="section-header-row">
        <span class="section-title">Generate Insight</span>
        <span class="cache-badge">cached 10 min</span>
      </div>
      <form method="POST" action="?/generateInsight" class="gen-form">
        <button class="button-secondary gen-btn" name="insightType" value="portfolio_health">Portfolio Health</button>
        <button class="button-secondary gen-btn" name="insightType" value="risk_analysis">Risk Analysis</button>
        <button class="button-secondary gen-btn" name="insightType" value="allocation_review">Allocation</button>
        <button class="button-secondary gen-btn" name="insightType" value="performance_summary">Performance</button>
        <button class="button-secondary gen-btn" name="insightType" value="market_commentary">Market</button>
      </form>
    </div>
    <AiInsightHistory insights={data.insights} />
  </div>
</div>

<style>
  .page-top     { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
  .page-actions { display: flex; flex-wrap: wrap; gap: 8px; }

  .top-grid  { display: grid; grid-template-columns: 1fr 0.75fr; gap: 12px; margin-bottom: 12px; }
  @media (max-width: 900px) { .top-grid { grid-template-columns: 1fr; } }

  .main-grid { display: grid; grid-template-columns: 0.75fr 1.25fr; gap: 12px; }
  @media (max-width: 1024px) { .main-grid { grid-template-columns: 1fr; } }

  .left-col  { display: flex; flex-direction: column; gap: 12px; }
  .right-col { display: flex; flex-direction: column; gap: 12px; }

  .section-card   { padding: 18px; }
  .section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
  .section-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .section-title  { font-size: 0.85rem; font-weight: 700; color: #dce8ff; }
  .cache-badge    { font-size: 0.62rem; font-weight: 600; padding: 2px 8px; border-radius: 20px;
                    background: rgba(108,143,255,0.1); color: #6c8fff; }

  .gen-form { display: flex; flex-wrap: wrap; gap: 8px; }
  .gen-btn  { font-size: 0.72rem; height: 32px; padding: 0 12px; }
</style>
