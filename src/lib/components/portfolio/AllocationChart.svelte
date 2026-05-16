<script lang="ts">
  import { money, percent } from '$lib/format';
  import type { AllocationSlice } from '$lib/types/portfolio';

  export let title: string;
  export let slices: AllocationSlice[] = [];
  export let currency = 'USD';

  const colors = ['#2563eb', '#147d52', '#b45309', '#7c3aed', '#0f766e', '#be123c'];
</script>

<div class="card p-5">
  <h2 class="font-bold">{title}</h2>
  <div class="mt-5 space-y-4">
    {#each slices as slice, index}
      <div>
        <div class="mb-2 flex items-center justify-between gap-3 text-sm">
          <span class="truncate font-semibold">{slice.label}</span>
          <span class="shrink-0 text-slate-500">{percent(slice.percentage)}</span>
        </div>
        <div class="h-3 overflow-hidden rounded-md bg-panel">
          <div class="h-full rounded-md" style={`width:${Math.min(Math.max(slice.percentage, 0), 100)}%;background:${colors[index % colors.length]}`}></div>
        </div>
        <div class="mt-1 text-xs text-slate-500">{money(slice.value, currency)}</div>
      </div>
    {/each}
    {#if slices.length === 0}
      <p class="text-sm text-slate-500">No allocation data yet.</p>
    {/if}
  </div>
</div>
