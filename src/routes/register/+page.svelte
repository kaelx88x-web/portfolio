<script lang="ts">
  import { ArrowRight, BarChart3 } from 'lucide-svelte';
</script>

<main class="grid min-h-screen bg-navy text-slate-100 lg:grid-cols-[1fr_1fr]">
  <section class="flex items-center justify-center px-4 py-12 sm:px-6">
    <div class="w-full max-w-md">
      <a href="/" class="mb-8 flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-300 text-slate-950">
          <BarChart3 size={20} />
        </div>
        <span class="font-bold text-white">PortfolioAI</span>
      </a>
      <h1 class="text-3xl font-bold text-white">Start building your AI portfolio workspace</h1>
      <p class="mt-3 text-sm leading-6 text-slate-400">Use dummy data now, then connect brokers when the backend is ready.</p>

      <form class="mt-8 space-y-4">
        <input class="field" placeholder="Full name" value="Aiman Portfolio" />
        <input class="field" type="email" placeholder="Email address" value="aiman@example.com" />
        <input class="field" type="password" placeholder="Password" value="portfolioai" />
        <a href="/dashboard" class="button w-full">Create account <ArrowRight size={17} /></a>
      </form>

      <p class="mt-6 text-center text-sm text-slate-400">
        Already have an account?
        <a href="/login" class="font-semibold text-cyan-200">Login</a>
      </p>
    </div>
  </section>

  <section class="hidden border-l border-white/10 bg-white/[0.04] p-10 lg:block">
    <div class="grid h-full content-center gap-4">
      {#each [
        ['Broker sync', 'Import positions and transactions from supported brokers.'],
        ['AI analysis', 'Ask what to trim, hold, hedge, or research next.'],
        ['Income planning', 'Project dividends, tax, reinvestment, and options premiums.']
      ] as item}
        <div class="rounded-lg border border-white/10 bg-white/[0.06] p-5">
          <h2 class="font-bold text-white">{item[0]}</h2>
          <p class="mt-2 text-sm leading-6 text-slate-400">{item[1]}</p>
        </div>
      {/each}
    </div>
  </section>
</main>
