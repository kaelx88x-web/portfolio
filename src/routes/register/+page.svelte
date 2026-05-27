<script lang="ts">
  import { ArrowRight, BarChart3, Loader2 } from 'lucide-svelte';
  import { createAuthClient } from 'better-auth/client';
  import { goto } from '$app/navigation';

  const authClient = createAuthClient();

  let name = '';
  let email = '';
  let password = '';
  let error = '';
  let loading = false;

  async function handleRegister() {
    error = '';
    if (password.length < 8) {
      error = 'Password must be at least 8 characters.';
      return;
    }
    loading = true;
    try {
      const result = await authClient.signUp.email({ name, email, password });
      if (result.error) {
        error = result.error.message ?? 'Registration failed.';
      } else {
        await goto('/dashboard');
      }
    } catch (e) {
      error = 'Registration failed. Please try again.';
    } finally {
      loading = false;
    }
  }
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
      <h1 class="text-3xl font-bold text-white">Start building your AI portfolio</h1>
      <p class="mt-3 text-sm leading-6 text-slate-400">Start with a paper account — no broker needed.</p>

      {#if error}
        <div class="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      {/if}

      <form class="mt-8 space-y-4" on:submit|preventDefault={handleRegister}>
        <input class="field" placeholder="Full name" bind:value={name} required />
        <input class="field" type="email" placeholder="Email address" bind:value={email} required />
        <input class="field" type="password" placeholder="Password (min 8 chars)" bind:value={password} required />
        <button class="button w-full" type="submit" disabled={loading}>
          {#if loading}<Loader2 size={16} class="animate-spin inline mr-2" />{/if}
          Create account <ArrowRight size={17} />
        </button>
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
        ['Paper trading', 'Start tracking any portfolio immediately — no broker connection needed.'],
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
