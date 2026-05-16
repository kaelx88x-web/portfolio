<script lang="ts">
  import { BarChart3 } from 'lucide-svelte';
</script>

<main class="grid min-h-screen bg-navy text-slate-100 lg:grid-cols-[0.9fr_1.1fr]">
  <section class="flex items-center justify-center px-4 py-12 sm:px-6">
    <div class="w-full max-w-md">
      <a href="/" class="mb-8 flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-300 text-slate-950">
          <BarChart3 size={20} />
        </div>
        <span class="font-bold text-white">PortfolioAI</span>
      </a>
      <h1 class="text-3xl font-bold text-white">Welcome back</h1>
      <p class="mt-2 text-sm text-slate-400">Sign in to your investing cockpit.</p>

      <form class="mt-8 space-y-4">
        <input class="field" type="email" placeholder="Email address" value="demo@portfolioai.app" />
        <input class="field" type="password" placeholder="Password" value="portfolioai" />
        <button class="button w-full" type="button">Login</button>
      </form>

      <p class="mt-6 text-center text-sm text-slate-400">
        New here?
        <a href="/register" class="font-semibold text-cyan-200">Create account</a>
      </p>
    </div>
  </section>

  <section class="hidden border-l border-white/10 bg-white/[0.04] p-10 lg:flex lg:items-center">
    <div class="w-full rounded-lg border border-white/10 bg-slate-950/40 p-6 shadow-soft">
      <div class="text-sm text-slate-400">AI Confidence Score</div>
      <div class="mt-2 text-5xl font-bold text-white">91%</div>
      <p class="mt-4 max-w-md text-sm leading-6 text-slate-300">
        Your portfolio is balanced for growth, but AI recommends trimming a single-stock overweight before earnings.
      </p>
      <div class="mt-6 grid gap-3">
        {#each ['Risk score improved by 8 points', 'Dividend income forecast updated', 'Moomoo sync completed 2m ago'] as item}
          <div class="rounded-lg border border-white/10 bg-white/[0.05] p-4 text-sm font-semibold text-slate-200">
            {item}
          </div>
        {/each}
      </div>
    </div>
  </section>
</main>
