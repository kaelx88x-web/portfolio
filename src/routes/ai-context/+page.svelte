<script lang="ts">
  import { BrainCircuit, DatabaseZap, FileJson, MessageSquareText, RefreshCw } from 'lucide-svelte';
  import { date, money, number, percent } from '$lib/format';
  import type { PageData } from './$types';

  export let data: PageData;

  $: context = data.context;
  $: prompt = data.prompt;

  function periodUrl(period: string) {
    return `/ai-context?period=${period}&benchmark=${data.benchmark}`;
  }

  function benchmarkUrl(benchmark: string) {
    return `/ai-context?period=${data.period}&benchmark=${benchmark}`;
  }

  function contextUrl(scope = 'full') {
    return `/api/v1/ai/context?period=${data.period}&benchmark=${data.benchmark}&scope=${scope}`;
  }
</script>

<div class="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
  <div>
    <h1 class="text-2xl font-bold tracking-normal">AI Context Layer</h1>
    <p class="mt-1 text-sm text-slate-500">
      Structured context, prompt blocks, and memory generated from portfolio analytics.
    </p>
  </div>

  <div class="flex flex-wrap items-center gap-2">
    <div class="flex rounded-md border border-line bg-white p-1">
      {#each data.periods as period}
        <a
          href={periodUrl(period)}
          class="rounded px-3 py-1.5 text-xs font-semibold transition {data.period === period ? 'bg-ink text-white' : 'text-slate-600 hover:bg-panel'}"
        >
          {period}
        </a>
      {/each}
    </div>
    <div class="flex rounded-md border border-line bg-white p-1">
      {#each data.benchmarks as item}
        <a
          href={benchmarkUrl(item)}
          class="rounded px-3 py-1.5 text-xs font-semibold transition {data.benchmark === item ? 'bg-accent text-white' : 'text-slate-600 hover:bg-panel'}"
        >
          {item}
        </a>
      {/each}
    </div>
    <form method="POST" action="?/refreshMemory">
      <button class="button h-9 px-3 text-xs" type="submit">
        <RefreshCw size={14} />
        Refresh Memory
      </button>
    </form>
  </div>
</div>

<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
  <div class="card p-5">
    <div class="flex items-center gap-2 text-slate-500">
      <BrainCircuit size={16} />
      <span class="label">Context hash</span>
    </div>
    <div class="mt-3 font-bold">{context.metadata.contextHash}</div>
    <div class="mt-1 text-xs text-slate-500">Generated {date(context.metadata.generatedAt)}</div>
  </div>
  <div class="card p-5">
    <div class="flex items-center gap-2 text-slate-500">
      <DatabaseZap size={16} />
      <span class="label">Source</span>
    </div>
    <div class="mt-3 font-bold capitalize">{context.metadata.dataSource.replace('_', ' ')}</div>
    <div class="mt-1 text-xs text-slate-500">{context.metadata.snapshotCount} snapshot{context.metadata.snapshotCount === 1 ? '' : 's'}</div>
  </div>
  <div class="card p-5">
    <div class="label">Portfolio value</div>
    <div class="mt-3 text-2xl font-bold">{money(context.portfolio.value)}</div>
    <div class="mt-1 text-xs text-slate-500">{context.portfolio.holdingsCount} holdings / {percent(context.portfolio.cashRatio)} cash</div>
  </div>
  <div class="card p-5">
    <div class="label">AI health</div>
    <div class="mt-3 text-2xl font-bold">{number(context.risk.healthScore, 0)}</div>
    <div class="mt-1 text-xs capitalize text-slate-500">{context.risk.healthLabel.replace('_', ' ')}</div>
  </div>
</section>

<section class="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
  <div class="card p-5">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h2 class="font-bold">Risk Flags</h2>
      <span class="rounded-md bg-panel px-2 py-1 text-xs font-semibold">{context.risk.flags.length}</span>
    </div>
    <div class="space-y-3">
      {#each context.risk.flags as flag}
        <div class="rounded-md border border-line p-3">
          <div class="flex items-center justify-between gap-3">
            <div class="text-sm font-semibold">{flag.title}</div>
            <span class="rounded bg-panel px-2 py-0.5 text-xs font-semibold uppercase">{flag.severity}</span>
          </div>
          <div class="mt-1 text-xs text-slate-500">{flag.detail}</div>
        </div>
      {/each}
      {#if context.risk.flags.length === 0}
        <div class="rounded-md border border-line bg-panel px-4 py-6 text-center text-sm text-slate-500">
          No risk flags in current context.
        </div>
      {/if}
    </div>
  </div>

  <div class="card p-5">
    <h2 class="font-bold">Prompt Hints</h2>
    <div class="mt-4 grid gap-4 sm:grid-cols-2">
      <div>
        <div class="label mb-2">Observation Seeds</div>
        <div class="space-y-2">
          {#each context.promptHints.observationSeeds as seed}
            <div class="rounded-md border border-line px-3 py-2 text-sm">{seed}</div>
          {/each}
        </div>
      </div>
      <div>
        <div class="label mb-2">Missing Data</div>
        <div class="space-y-2">
          {#each context.promptHints.missingData as item}
            <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{item}</div>
          {/each}
          {#if context.promptHints.missingData.length === 0}
            <div class="rounded-md border border-line px-3 py-2 text-sm text-slate-500">No missing data flags.</div>
          {/if}
        </div>
      </div>
      <div class="sm:col-span-2">
        <div class="label mb-2">Resolved From Moomoo</div>
        <div class="grid gap-2 sm:grid-cols-3">
          <div class="rounded-md border border-line bg-panel px-3 py-2 text-sm">
            Quote snapshots: <span class="font-semibold">{context.marketData.holdingsQuoteCount}</span>
          </div>
          <div class="rounded-md border border-line bg-panel px-3 py-2 text-sm">
            Market states: <span class="font-semibold">{context.marketData.holdingsStateCount}</span>
          </div>
          <div class="rounded-md border border-line bg-panel px-3 py-2 text-sm">
            {context.marketData.benchmarkCode} candles: <span class="font-semibold">{context.marketData.benchmarkHistoryCount}</span>
          </div>
        </div>
        <div class="mt-2 space-y-2">
          {#each context.promptHints.resolvedFromMoomoo as item}
            <div class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{item}</div>
          {/each}
          {#if context.promptHints.resolvedFromMoomoo.length === 0}
            <div class="rounded-md border border-line px-3 py-2 text-sm text-slate-500">No Moomoo market data resolved yet.</div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</section>

<section class="mt-6 grid gap-6 xl:grid-cols-2">
  <div class="card p-5">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h2 class="font-bold">AI Payload</h2>
      <div class="flex gap-2">
        <a class="icon-button" title="Full context JSON" href={contextUrl()}>
          <FileJson size={16} />
        </a>
        <a class="icon-button" title="Risk context JSON" href={contextUrl('risk')}>
          <BrainCircuit size={16} />
        </a>
      </div>
    </div>
    <pre class="max-h-[34rem] overflow-auto rounded-md border border-line bg-panel p-4 text-xs leading-relaxed text-slate-700">{data.contextJson}</pre>
  </div>

  <div class="space-y-6">
    <div class="card p-5">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 class="font-bold">Prompt Builder</h2>
        <a class="icon-button" title="Prompt JSON" href={`/api/v1/ai/prompt?period=${data.period}&benchmark=${data.benchmark}`}>
          <MessageSquareText size={16} />
        </a>
      </div>
      <div class="label mb-2">System</div>
      <div class="rounded-md border border-line bg-panel p-3 text-sm">{prompt.system}</div>
      <div class="label mb-2 mt-4">Developer Guardrails</div>
      <div class="space-y-2">
        {#each prompt.developer as item}
          <div class="rounded-md border border-line px-3 py-2 text-sm">{item}</div>
        {/each}
      </div>
      <div class="label mb-2 mt-4">Templates</div>
      <div class="space-y-2">
        {#each Object.entries(prompt.userTemplates) as [key, value]}
          <div class="rounded-md border border-line p-3">
            <div class="text-xs font-semibold uppercase text-slate-500">{key}</div>
            <div class="mt-1 text-sm">{value}</div>
          </div>
        {/each}
      </div>
    </div>

    <div class="card p-5">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 class="font-bold">AI Memory</h2>
        <a class="icon-button" title="Memory JSON" href="/api/v1/ai/memory">
          <DatabaseZap size={16} />
        </a>
      </div>
      <div class="space-y-3">
        {#each data.memories as memory}
          <div class="rounded-md border border-line p-3">
            <div class="flex items-center justify-between gap-3">
              <div class="text-sm font-semibold">{memory.contextHash}</div>
              <div class="text-xs text-slate-500">{date(memory.createdAt)}</div>
            </div>
            <div class="mt-1 text-xs text-slate-500">{memory.summary}</div>
          </div>
        {/each}
        {#if data.memories.length === 0}
          <div class="rounded-md border border-line bg-panel px-4 py-6 text-center text-sm text-slate-500">
            No saved AI memory yet.
          </div>
        {/if}
      </div>
    </div>
  </div>
</section>
