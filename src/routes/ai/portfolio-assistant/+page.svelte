<script lang="ts">
  import { BarChart3, Network, PieChart, RefreshCw, Table2 } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AiEducationalTip from '$lib/components/ai/AiEducationalTip.svelte';
  import AllocationInsightCard from '$lib/components/ai/AllocationInsightCard.svelte';
  import DiversificationInsightCard from '$lib/components/ai/DiversificationInsightCard.svelte';
  import HoldingsInsightTable from '$lib/components/ai/HoldingsInsightTable.svelte';
  import PortfolioAssistantPanel from '$lib/components/ai/PortfolioAssistantPanel.svelte';
  import PortfolioNarrativeCard from '$lib/components/ai/PortfolioNarrativeCard.svelte';
  import PortfolioStoryTimeline from '$lib/components/ai/PortfolioStoryTimeline.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;
</script>

<div class="page-top">
  <PageHeader
    title="Portfolio Assistant AI"
    subtitle="Plain-language explanations for portfolio structure, allocation, diversification, holdings, and performance."
    breadcrumb={[{ label: 'AI', href: '/ai' }, { label: 'Portfolio Assistant' }]}
  />
  <div class="actions">
    <a class="button-secondary" href="/ai/portfolio-assistant/allocation"><PieChart size={15} /> Allocation</a>
    <a class="button-secondary" href="/ai/portfolio-assistant/diversification"><Network size={15} /> Diversification</a>
    <a class="button-secondary" href="/ai/portfolio-assistant/performance"><BarChart3 size={15} /> Performance</a>
    <form method="POST" action="?/refresh">
      <button class="button" type="submit"><RefreshCw size={15} /> Refresh</button>
    </form>
  </div>
</div>

{#if form?.message}
  <div class="error-banner">{form.message}</div>
{/if}

{#if form?.answer}
  <div class="answer-panel">
    <h2>{form.answer.title}</h2>
    <p>{form.answer.summary}</p>
    <AiEducationalTip note={form.answer.educational_note} />
  </div>
{/if}

<div class="layout">
  <main class="main-col">
    <PortfolioNarrativeCard narrative={data.narrative} confidence={data.summary.confidence} />
    <PortfolioStoryTimeline timeline={data.storyTimeline} />
    <PortfolioAssistantPanel response={data.summary} type="portfolio" />
    <div class="section-head">
      <Table2 size={16} />
      <h2>Holdings Intelligence</h2>
    </div>
    <HoldingsInsightTable holdings={data.holdingsTable} />
  </main>

  <aside class="side-col">
    <AllocationInsightCard response={data.allocation} />
    <DiversificationInsightCard response={data.diversification} />
    <div class="panel">
      <h2>Suggested Questions</h2>
      <div class="chips">
        {#each data.suggestedQuestions as question}
          <form method="POST" action="?/ask">
            <input type="hidden" name="question" value={question} />
            <input type="hidden" name="type" value="portfolio" />
            <button type="submit">{question}</button>
          </form>
        {/each}
      </div>
    </div>
  </aside>
</div>

<style>
  .page-top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 24rem;
    gap: 12px;
  }

  .main-col,
  .side-col {
    display: grid;
    align-content: start;
    gap: 12px;
  }

  .panel,
  .answer-panel {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 14px;
  }

  .answer-panel {
    margin-bottom: 12px;
  }

  .answer-panel h2,
  .panel h2,
  .section-head h2 {
    margin: 0;
    color: var(--text);
    font-size: 0.9rem;
  }

  .answer-panel p {
    margin: 8px 0 12px;
    color: var(--muted);
    font-size: 0.78rem;
    line-height: 1.5;
  }

  .section-head {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--primary);
  }

  .chips {
    display: grid;
    gap: 8px;
    margin-top: 12px;
  }

  .chips button {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: rgba(var(--primary-rgb), 0.06);
    color: var(--text);
    padding: 9px;
    text-align: left;
    font-size: 0.74rem;
    cursor: pointer;
  }

  .error-banner {
    margin-bottom: 12px;
    border: 1px solid rgba(var(--danger-rgb), 0.3);
    border-radius: 8px;
    background: rgba(var(--danger-rgb), 0.08);
    color: var(--danger);
    padding: 10px 12px;
    font-size: 0.78rem;
  }

  @media (max-width: 1100px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
</style>
