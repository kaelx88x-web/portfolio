<script lang="ts">
  import { History } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AiCopilotChat from '$lib/components/ai/AiCopilotChat.svelte';
  import AiDisclaimerBox from '$lib/components/ai/AiDisclaimerBox.svelte';
  import AiInsightHistory from '$lib/components/ai/AiInsightHistory.svelte';
  import AiPortfolioSummaryCard from '$lib/components/ai/AiPortfolioSummaryCard.svelte';
  import AiSuggestionChips from '$lib/components/ai/AiSuggestionChips.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  let chatRef: AiCopilotChat;
</script>

<div class="page-top">
  <PageHeader
    title="Copilot Chat"
    subtitle="Ask about health, risk, allocation, benchmark, and performance."
    breadcrumb={[{ label: 'AI', href: '/ai' }, { label: 'Chat' }]}
  />
  <a class="button-secondary" href="/ai/conversations"><History size={15} /> History</a>
</div>

<div class="chat-layout">
  <!-- Main chat -->
  <div class="chat-main">
    <AiCopilotChat bind:this={chatRef} conversation={data.activeConversation} period={data.period} benchmark={data.benchmark} />
    <div class="card chips-card">
      <div class="chips-title">Quick Questions</div>
      <AiSuggestionChips suggestions={data.suggestions} on:select={(e) => chatRef?.sendQuestion(e.detail)} />
    </div>
  </div>

  <!-- Sidebar -->
  <aside class="chat-aside">
    <AiPortfolioSummaryCard context={data.context} />
    <AiDisclaimerBox />
    <div>
      <div class="aside-title">Recent Insights</div>
      <AiInsightHistory insights={data.insights.slice(0, 2)} />
    </div>
  </aside>
</div>

<style>
  .page-top    { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }

.chat-layout { display: grid; grid-template-columns: 1fr 22rem; gap: 16px; }
  @media (max-width: 1100px) { .chat-layout { grid-template-columns: 1fr; } }

  .chat-main   { display: flex; flex-direction: column; gap: 12px; }
  .chat-aside  { display: flex; flex-direction: column; gap: 12px; }

  .chips-card  { padding: 16px; }
  .chips-title { font-size: 0.82rem; font-weight: 700; color: var(--text); margin-bottom: 12px; }

  .aside-title { font-size: 0.82rem; font-weight: 700; color: var(--text); margin-bottom: 10px; }
</style>
