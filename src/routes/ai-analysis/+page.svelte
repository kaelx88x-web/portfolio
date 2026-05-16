<script lang="ts">
  import { Bot, Send } from 'lucide-svelte';
  import AIInsightCard from '$lib/components/portfolioai/AIInsightCard.svelte';

  const prompts = [
    'Analyze my portfolio risk',
    'Which stock should I trim?',
    'Find undervalued stocks',
    'Estimate monthly dividend income'
  ];
</script>

<div class="mb-6">
  <h1 class="text-2xl font-bold text-white">AI Analysis</h1>
  <p class="mt-1 text-sm text-slate-400">Ask PortfolioAI for portfolio risk, trim ideas, undervalued stocks, and income estimates.</p>
</div>

<section class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
  <div class="card flex min-h-[620px] flex-col p-5">
    <div class="flex items-center gap-2 border-b border-white/10 pb-4">
      <div class="flex h-9 w-9 items-center justify-center rounded-md bg-cyan-300 text-slate-950">
        <Bot size={18} />
      </div>
      <div>
        <h2 class="font-bold text-white">PortfolioAI Chat</h2>
        <p class="text-xs text-slate-400">Demo responses use dummy portfolio context.</p>
      </div>
    </div>

    <div class="flex-1 space-y-4 overflow-y-auto py-5">
      <div class="max-w-[82%] rounded-lg border border-white/10 bg-white/[0.06] p-4 text-sm leading-6 text-slate-200">
        Analyze my portfolio risk
      </div>
      <div class="ml-auto max-w-[88%] rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50">
        Your portfolio risk is moderate. The largest driver is single-name exposure in NIO plus short options sensitivity around expiry week.
      </div>
    </div>

    <div class="mb-4 flex flex-wrap gap-2">
      {#each prompts as prompt}
        <button class="rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-slate-200">
          {prompt}
        </button>
      {/each}
    </div>
    <div class="flex gap-2">
      <input class="field" placeholder="Ask about risk, dividends, stocks, options..." />
      <button class="button w-12 px-0" aria-label="Send"><Send size={17} /></button>
    </div>
  </div>

  <div class="space-y-5">
    <AIInsightCard title="Risk Summary" summary="Moderate risk with concentration in growth stocks. AI recommends reducing any single position above 25% of gross exposure." confidence="89% confidence" risk="Medium" action="Rebalance" />
    <AIInsightCard title="Undervalued Candidate" summary="TSM screens well on earnings quality, AI score, and valuation relative to peers. Add it to watchlist for pullback entries." confidence="84% confidence" risk="Low" action="Watch" />
    <AIInsightCard title="Dividend Estimate" summary="Current holdings and planned additions indicate projected monthly dividend income of $842.50 before tax." confidence="92% confidence" risk="Low" action="Reinvest" />
  </div>
</section>
