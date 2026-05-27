<script lang="ts">
  import { BarChart3, Loader2 } from 'lucide-svelte';
  import { createAuthClient } from 'better-auth/client';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  const authClient = createAuthClient({
    baseURL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
  });

  let email = '';
  let password = '';
  let error = '';
  let loading = false;

  // Show banned message if redirected with ?error=banned
  $: if ($page.url.searchParams.get('error') === 'banned') {
    error = 'Your account has been suspended. Contact support.';
  }

  async function handleLogin() {
    error = '';
    loading = true;
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        error = result.error.message ?? 'Invalid email or password.';
      } else {
        await goto('/dashboard');
      }
    } catch (e) {
      error = 'Login failed. Please try again.';
    } finally {
      loading = false;
    }
  }
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

      {#if error}
        <div class="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      {/if}

      <form class="mt-8 space-y-4" on:submit|preventDefault={handleLogin}>
        <input class="field" type="email" placeholder="Email address" bind:value={email} required />
        <input class="field" type="password" placeholder="Password" bind:value={password} required />
        <button class="button w-full" type="submit" disabled={loading}>
          {#if loading}<Loader2 size={16} class="animate-spin inline mr-2" />{/if}
          Login
        </button>
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
