<script lang="ts">
  import { BrainCircuit, RefreshCw, Route, Send, ShieldCheck, Wrench } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AiConfidenceBadge from '$lib/components/ai/AiConfidenceBadge.svelte';
  import AiContextStatus from '$lib/components/ai/AiContextStatus.svelte';
  import AiIntentBadge from '$lib/components/ai/AiIntentBadge.svelte';
  import AiPipelineViewer from '$lib/components/ai/AiPipelineViewer.svelte';
  import AiProviderBadge from '$lib/components/ai/AiProviderBadge.svelte';
  import AiReasoningTrace from '$lib/components/ai/AiReasoningTrace.svelte';
  import AiToolExecutionCard from '$lib/components/ai/AiToolExecutionCard.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  $: result = form?.result ?? null;
</script>

<div class="page-top">
  <PageHeader
    title="AI Orchestrator"
    subtitle="Intent routing, context resolution, tool calls, provider selection, and validated AI response."
    breadcrumb={[{ label: 'AI', href: '/ai' }, { label: 'Orchestrator' }]}
  />
  <div class="page-actions">
    <a class="button-secondary" href="/ai/providers"><Route size={15} /> Providers</a>
    <a class="button-secondary" href="/ai/tools"><Wrench size={15} /> Tools</a>
  </div>
</div>

{#if form?.message}
  <div class="error-banner">{form.message}</div>
{/if}

<div class="orchestrator-grid">
  <section class="main-col">
    <div class="panel ask-panel">
      <div class="panel-head">
        <BrainCircuit size={16} />
        <h2>Ask Through Pipeline</h2>
      </div>
      <form method="POST" action="?/ask" class="ask-form">
        <textarea
          name="question"
          rows="4"
          placeholder="What is my biggest risk and which tool evidence supports it?"
          required
        ></textarea>
        <div class="ask-row">
          <select name="analysisMode" aria-label="Analysis mode">
            <option value="fast_chat">Fast chat</option>
            <option value="deep_analysis">Deep analysis</option>
            <option value="long_report">Long report</option>
          </select>
          <button class="button" type="submit"><Send size={15} /> Run Orchestrator</button>
        </div>
      </form>
    </div>

    {#if result}
      <AiContextStatus context={result.context} />

      <div class="panel response-panel">
        <div class="response-head">
          <div class="badge-row">
            <AiIntentBadge intent={result.intent.type} />
            <AiProviderBadge provider={result.provider.provider} model={result.provider.model} />
            <AiConfidenceBadge confidence={result.response.confidence} />
          </div>
          <span>{result.responseTimeMs}ms</span>
        </div>
        <h2>{result.response.summary}</h2>

        <div class="response-lists">
          <div>
            <h3>Key Observations</h3>
            <ul>
              {#each result.response.key_observations as item}<li>{item}</li>{/each}
            </ul>
          </div>
          <div>
            <h3>Risk Flags</h3>
            <ul>
              {#each result.response.risk_flags as item}<li>{item}</li>{/each}
            </ul>
          </div>
          <div>
            <h3>Considerations</h3>
            <ul>
              {#each result.response.considerations as item}<li>{item}</li>{/each}
            </ul>
          </div>
        </div>
      </div>

      <div class="tool-grid">
        {#each result.response.tool_calls as call}
          <AiToolExecutionCard {call} />
        {/each}
      </div>
    {:else}
      <div class="panel intro-panel">
        <ShieldCheck size={18} />
        <p>Phase 5A is ready to classify intent, resolve context, call internal tools, choose a provider, validate a structured response, and log the run.</p>
      </div>
    {/if}
  </section>

  <aside class="side-col">
    <div class="panel">
      <div class="panel-head">
        <Route size={16} />
        <h2>Pipeline</h2>
      </div>
      <AiPipelineViewer {result} />
    </div>

    <div class="panel">
      <div class="panel-head">
        <RefreshCw size={16} />
        <h2>Reasoning Trace</h2>
      </div>
      <AiReasoningTrace trace={result?.reasoningTrace ?? []} />
    </div>

    <div class="panel">
      <div class="panel-head">
        <Wrench size={16} />
        <h2>Recent Tool Calls</h2>
      </div>
      <div class="mini-list">
        {#each data.toolLogs.slice(0, 5) as log}
          <span>{log.toolName.replaceAll('_', ' ')}</span>
        {:else}
          <span>No tool logs yet.</span>
        {/each}
      </div>
    </div>
  </aside>
</div>

<style>
  .page-top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .page-actions,
  .badge-row,
  .ask-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .error-banner {
    margin-bottom: 12px;
    border: 1px solid rgba(var(--danger-rgb), 0.3);
    border-radius: 8px;
    background: rgba(var(--danger-rgb), 0.08);
    color: var(--danger);
    padding: 10px 12px;
    font-size: 0.78rem;
  }

  .orchestrator-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 24rem;
    gap: 12px;
  }

  .main-col,
  .side-col {
    display: grid;
    align-content: start;
    gap: 12px;
  }

  .panel {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 14px;
  }

  .panel-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    color: var(--primary);
  }

  .panel-head h2 {
    margin: 0;
    color: var(--text);
    font-size: 0.86rem;
  }

  .ask-form {
    display: grid;
    gap: 10px;
  }

  textarea,
  select {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: rgba(6, 12, 24, 0.72);
    color: var(--text);
    padding: 10px 11px;
    font: inherit;
    font-size: 0.82rem;
  }

  textarea {
    min-height: 108px;
    resize: vertical;
  }

  select {
    max-width: 170px;
    height: 36px;
  }

  .ask-row {
    justify-content: space-between;
    align-items: center;
  }

  .response-head {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
    margin-bottom: 12px;
  }

  .response-head > span {
    color: var(--muted);
    font-size: 0.7rem;
  }

  .response-panel h2 {
    margin: 0 0 14px;
    color: var(--text);
    font-size: 1rem;
    line-height: 1.45;
  }

  .response-lists {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .response-lists h3 {
    margin: 0 0 8px;
    color: var(--text);
    font-size: 0.78rem;
  }

  ul {
    display: grid;
    gap: 6px;
    margin: 0;
    padding-left: 16px;
    color: var(--muted);
    font-size: 0.75rem;
    line-height: 1.45;
  }

  .tool-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .intro-panel {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--muted);
    font-size: 0.8rem;
    line-height: 1.5;
  }

  .intro-panel p {
    margin: 0;
  }

  .mini-list {
    display: grid;
    gap: 7px;
  }

  .mini-list span {
    color: var(--muted);
    font-size: 0.74rem;
    text-transform: capitalize;
  }

  @media (max-width: 1100px) {
    .orchestrator-grid {
      grid-template-columns: 1fr;
    }

    .response-lists,
    .tool-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
