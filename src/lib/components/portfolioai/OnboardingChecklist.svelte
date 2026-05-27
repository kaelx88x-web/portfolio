<script lang="ts">
  import { enhance } from '$app/forms';
  import { CheckCircle2, Circle, ArrowRight } from 'lucide-svelte';

  export let hasCash: boolean = false;
  export let hasBroker: boolean = false;
  export let onboardingCompleted: boolean = false;

  $: items = [
    { id: 'account', label: 'Create account',    done: true,               href: null },
    { id: 'cash',    label: 'Set cash balance',  done: hasCash,            href: '/accounts' },
    { id: 'broker',  label: 'Connect broker',    done: hasBroker,          href: '/broker', optional: true },
    { id: 'explore', label: 'Explore dashboard', done: onboardingCompleted, href: null },
  ];

  $: doneCount = items.filter(i => i.done).length;
  $: allDone = doneCount === items.length;
</script>

{#if !allDone}
<div class="rounded-xl border border-[rgba(var(--success-rgb),0.2)] bg-[#0f1a12] p-4" style="margin-bottom:12px">
  <div class="mb-3 flex items-center justify-between">
    <span class="text-xs font-semibold uppercase tracking-wide" style="color:var(--success)">
      Getting Started — {doneCount}/{items.length}
    </span>
    <form method="POST" action="?/dismissOnboarding" use:enhance>
      <button type="submit" class="text-xs" style="color:var(--muted)">Dismiss</button>
    </form>
  </div>

  <div class="space-y-2">
    {#each items as item}
      <div class="flex items-center gap-2 text-sm">
        {#if item.done}
          <CheckCircle2 size={15} style="color:var(--success);flex-shrink:0" />
          <span style="color:var(--muted);text-decoration:line-through">{item.label}</span>
        {:else if item.href}
          <Circle size={15} style="color:var(--muted);flex-shrink:0" />
          <a href={item.href} class="flex items-center gap-1 hover:underline" style="color:var(--primary)">
            {item.label}
            <ArrowRight size={12} />
          </a>
          {#if item.optional}
            <span class="text-xs" style="color:var(--muted)">(optional)</span>
          {/if}
        {:else}
          <Circle size={15} style="color:var(--muted);flex-shrink:0" />
          <span style="color:var(--muted)">{item.label}</span>
          {#if item.optional}
            <span class="text-xs" style="color:var(--muted)">(optional)</span>
          {/if}
        {/if}
      </div>
    {/each}
  </div>

  <div class="mt-3 h-1 rounded-full" style="background:var(--border)">
    <div
      class="h-1 rounded-full transition-all"
      style="background:var(--success);width:{(doneCount/items.length)*100}%"
    ></div>
  </div>
</div>
{/if}
