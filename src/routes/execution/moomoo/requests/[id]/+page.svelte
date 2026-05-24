<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import ExecutionRequestCard from '$lib/components/execution/ExecutionRequestCard.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;
</script>

<div class="page-top">
  <PageHeader title={`Execution ${data.execution.brokerSymbol}`} subtitle="Moomoo execution request, safety checks, and submission response." breadcrumb={[{ label: 'Execution', href: '/execution/moomoo' }, { label: data.execution.brokerSymbol }]} />
  <a class="button-secondary" href="/execution/moomoo">Back</a>
</div>

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<div class="layout">
  <main class="main-col">
    <ExecutionRequestCard execution={data.execution} />
  </main>
  <aside class="panel">
    <h2>Submissions</h2>
    {#if (data.execution.submissions ?? []).length === 0}
      <p>No submission yet.</p>
    {:else}
      {#each data.execution.submissions ?? [] as submission}
        <article>
          <span>{submission.submissionStatus} / {submission.submitMode}</span>
          <strong>{submission.brokerOrderId ?? 'No broker id'}</strong>
          <p>{submission.errorMessage ?? submission.brokerStatus}</p>
        </article>
      {/each}
    {/if}
  </aside>
</div>

<style>
  .page-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .notice { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 24rem; gap: 12px; }
  .main-col, .panel { display: grid; align-content: start; gap: 12px; }
  .panel, article { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  article { display: grid; gap: 4px; }
  h2 { margin: 0; color: var(--text); font-size: 0.95rem; }
  span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  strong { color: var(--text); font-size: 0.82rem; overflow-wrap: anywhere; }
  p { margin: 0; color: var(--muted); font-size: 0.74rem; line-height: 1.45; }
  @media (max-width: 1040px) { .layout { grid-template-columns: 1fr; } .page-top { align-items: start; flex-direction: column; } }
</style>
