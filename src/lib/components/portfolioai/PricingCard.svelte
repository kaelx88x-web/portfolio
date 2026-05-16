<script lang="ts">
  import { Check } from 'lucide-svelte';

  export let name: string;
  export let price: string;
  export let description: string;
  export let features: string[] = [];
  export let featured = false;
</script>

<article class={`card p-6 ${featured ? 'border-cyan-300/40 shadow-glow' : ''}`}>
  <div class="flex items-center justify-between gap-3">
    <h3 class="text-lg font-bold text-white">{name}</h3>
    {#if featured}
      <span class="rounded-md bg-cyan-300 px-2 py-1 text-xs font-bold text-slate-950">Popular</span>
    {/if}
  </div>
  <div class="mt-5 text-3xl font-bold text-white">{price}</div>
  <p class="mt-3 text-sm leading-6 text-slate-400">{description}</p>
  <ul class="mt-6 space-y-3">
    {#each features as feature}
      <li class="flex items-center gap-2 text-sm text-slate-300">
        <Check size={15} class="text-emerald-300" />
        {feature}
      </li>
    {/each}
  </ul>
  <a href="/register" class={featured ? 'button mt-6 w-full' : 'button-secondary mt-6 w-full'}>
    Start Free
  </a>
</article>
