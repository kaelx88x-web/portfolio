<script lang="ts">
  import { ArrowRight, Bot, CalendarDays, Link2, PieChart, ShieldCheck, Sparkles, TrendingUp } from 'lucide-svelte';
  import PricingCard from '$lib/components/portfolioai/PricingCard.svelte';

  const features = [
    { title: 'AI portfolio analysis', copy: 'Explain risk, concentration, upside scenarios, and trim candidates in plain language.', icon: Bot },
    { title: 'Unified portfolio tracking', copy: 'Track holdings, realized P/L, dividends, options income, and allocation drift.', icon: PieChart },
    { title: 'Broker sync workflow', copy: 'Connect Moomoo, Webull, Alpaca, or Interactive Brokers for transaction imports.', icon: Link2 },
    { title: 'Dividend planning', copy: 'Forecast monthly cash flow, tax impact, and reinvestment compounding.', icon: CalendarDays }
  ];

  const faqs = [
    ['Can PortfolioAI trade for me?', 'No. It helps analyze and plan. You stay in control of every trade.'],
    ['Can I start with dummy data?', 'Yes. The demo UI is built to work without a backend while the product flow is refined.'],
    ['Does it support options wheel tracking?', 'Yes. It includes cash-secured puts, covered calls, assignment status, and premium income.']
  ];
</script>

<main class="min-h-screen bg-navy text-slate-100">
  <header class="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
    <a href="/" class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-300 text-slate-950">
        <TrendingUp size={20} />
      </div>
      <span class="font-bold text-white">PortfolioAI</span>
    </a>
    <nav class="hidden items-center gap-6 text-sm font-semibold text-slate-300 md:flex">
      <a href="#features" class="hover:text-white">Features</a>
      <a href="#pricing" class="hover:text-white">Pricing</a>
      <a href="/login" class="hover:text-white">Login</a>
    </nav>
    <a href="/register" class="button">Start Free</a>
  </header>

  <section class="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[0.95fr_1.05fr]">
    <div>
      <div class="mb-5 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-200">
        <Sparkles size={16} />
        AI-native investing workspace
      </div>
      <h1 class="max-w-4xl text-4xl font-bold leading-tight text-white sm:text-6xl">
        AI Portfolio Assistant for Smarter Stock Investing
      </h1>
      <p class="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
        Analyze stocks with AI, track portfolio performance, plan dividend income, manage options wheel trades, and sync broker activity from one premium fintech dashboard.
      </p>
      <div class="mt-8 flex flex-wrap gap-3">
        <a href="/register" class="button h-12 px-5">Start Free <ArrowRight size={17} /></a>
        <a href="/dashboard" class="button-secondary h-12 px-5">View Demo</a>
      </div>
    </div>

    <div class="rounded-lg border border-white/10 bg-white/[0.06] p-4 shadow-soft backdrop-blur-xl">
      <div class="rounded-lg border border-white/10 bg-slate-950/40 p-4">
        <div class="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div class="text-sm text-slate-400">Total Portfolio Value</div>
            <div class="mt-1 text-3xl font-bold text-white">$128,420.88</div>
          </div>
          <div class="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm font-bold text-emerald-200">
            +12.8% YTD
          </div>
        </div>
        <div class="mt-5 grid gap-3 sm:grid-cols-3">
          {#each ['Risk 64', 'AI 91%', 'Div $842'] as metric}
            <div class="rounded-lg border border-white/10 bg-white/[0.06] p-3 text-sm font-bold text-white">{metric}</div>
          {/each}
        </div>
        <div class="mt-5 flex h-56 items-end gap-2">
          {#each [42, 58, 52, 70, 64, 76, 88, 82, 94, 100, 92, 108] as point}
            <div class="flex-1 rounded-md bg-gradient-to-t from-cyan-400 to-emerald-300" style={`height:${point}px`}></div>
          {/each}
        </div>
      </div>
    </div>
  </section>

  <section id="features" class="mx-auto max-w-7xl px-4 py-16 sm:px-6">
    <div class="max-w-2xl">
      <h2 class="text-3xl font-bold text-white">Built for investors who want signal, not noise.</h2>
      <p class="mt-3 text-slate-400">A modern cockpit for portfolio decisions, broker activity, income planning, and AI-assisted research.</p>
    </div>
    <div class="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {#each features as feature}
        <article class="card p-5">
          <div class="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
            <svelte:component this={feature.icon} size={18} />
          </div>
          <h3 class="mt-5 font-bold text-white">{feature.title}</h3>
          <p class="mt-3 text-sm leading-6 text-slate-400">{feature.copy}</p>
        </article>
      {/each}
    </div>
  </section>

  <section class="mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-3">
    {#each ['Sync broker data', 'Ask the AI assistant', 'Act with a clear plan'] as step, index}
      <div class="rounded-lg border border-white/10 bg-white/[0.04] p-6">
        <div class="text-sm font-bold text-cyan-200">0{index + 1}</div>
        <h3 class="mt-4 text-xl font-bold text-white">{step}</h3>
        <p class="mt-3 text-sm leading-6 text-slate-400">
          PortfolioAI turns holdings, watchlists, dividends, and options into an organized decision workflow.
        </p>
      </div>
    {/each}
  </section>

  <section id="pricing" class="mx-auto max-w-7xl px-4 py-16 sm:px-6">
    <h2 class="text-3xl font-bold text-white">Pricing that scales with your investing workflow.</h2>
    <div class="mt-8 grid gap-5 lg:grid-cols-3">
      <PricingCard name="Starter" price="$0" description="Explore the full demo workspace." features={['Portfolio dashboard', 'Watchlist', 'Basic AI insights']} />
      <PricingCard name="Pro" price="$19/mo" description="For active investors tracking real portfolios." features={['Broker sync', 'Options wheel tracker', 'Dividend planner']} featured />
      <PricingCard name="Desk" price="$49/mo" description="For advanced screening and portfolio workflows." features={['Advanced AI analysis', 'Multi-broker import', 'Priority exports']} />
    </div>
  </section>

  <section class="mx-auto max-w-4xl px-4 py-16 sm:px-6">
    <h2 class="text-3xl font-bold text-white">FAQ</h2>
    <div class="mt-6 space-y-3">
      {#each faqs as faq}
        <details class="rounded-lg border border-white/10 bg-white/[0.05] p-4">
          <summary class="cursor-pointer font-bold text-white">{faq[0]}</summary>
          <p class="mt-3 text-sm leading-6 text-slate-400">{faq[1]}</p>
        </details>
      {/each}
    </div>
  </section>

  <footer class="border-t border-white/10 px-4 py-8 text-center text-sm text-slate-500">
    PortfolioAI © 2026. AI-assisted investing workspace for research and portfolio planning.
  </footer>
</main>
