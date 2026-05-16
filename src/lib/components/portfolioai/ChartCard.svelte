<script lang="ts">
  export let title: string;
  export let subtitle = '';
  export let points: number[] = [];
  export let labels: string[] = [];
  export let mode: 'bars' | 'allocation' = 'bars';

  $: max = Math.max(...points, 1);
  const colors = ['bg-cyan-300', 'bg-emerald-300', 'bg-indigo-300', 'bg-amber-300', 'bg-rose-300'];
</script>

<section class="card p-5">
  <div class="mb-5 flex items-start justify-between gap-3">
    <div>
      <h2 class="font-bold text-white">{title}</h2>
      {#if subtitle}
        <p class="mt-1 text-sm text-slate-400">{subtitle}</p>
      {/if}
    </div>
    <slot name="action" />
  </div>

  {#if mode === 'bars'}
    <div class="flex h-56 items-end gap-2 rounded-lg border border-white/10 bg-slate-950/30 p-4 shadow-inner">
      {#each points as point, index}
        <div class="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div
            class="w-full rounded-md bg-gradient-to-t from-cyan-400 to-emerald-300"
            style={`height:${Math.max((point / max) * 100, 8)}%`}
          ></div>
          {#if labels[index]}
            <span class="text-[10px] font-semibold text-slate-500">{labels[index]}</span>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="space-y-4">
      {#each points as point, index}
        <div>
          <div class="mb-2 flex items-center justify-between text-sm">
            <span class="font-semibold text-slate-200">{labels[index]}</span>
            <span class="text-slate-400">{point}%</span>
          </div>
          <div class="h-3 overflow-hidden rounded-md bg-white/10">
            <div class={`h-full rounded-md ${colors[index % colors.length]}`} style={`width:${point}%`}></div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>
