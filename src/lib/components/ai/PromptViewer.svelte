<script lang="ts">
  import PromptCompressionBadge from './PromptCompressionBadge.svelte';
  import PromptProviderBadge from './PromptProviderBadge.svelte';

  export let prompt: any;
</script>

<section class="viewer">
  <div class="viewer-head">
    <div>
      <h2>{prompt.prompt_type}</h2>
      <p>{prompt.model}</p>
    </div>
    <div class="badges">
      <PromptProviderBadge provider={prompt.provider} />
      <PromptCompressionBadge
        compressed={prompt.context?.compressed}
        ratio={prompt.context?.compression_ratio ?? 0}
      />
    </div>
  </div>

  <div class="metrics">
    <div>
      <span>Raw Tokens</span>
      <strong>{prompt.context?.raw_tokens ?? 0}</strong>
    </div>
    <div>
      <span>Prompt Tokens</span>
      <strong>{prompt.context?.compressed_tokens ?? 0}</strong>
    </div>
    <div>
      <span>Cache</span>
      <strong>{prompt.cache?.hit ? 'hit' : 'miss'}</strong>
    </div>
  </div>

  <pre>{JSON.stringify(prompt.formatted, null, 2)}</pre>
</section>

<style>
  .viewer {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    overflow: hidden;
  }

  .viewer-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid var(--border);
  }

  h2 {
    margin: 0;
    color: var(--text);
    font-size: 0.95rem;
  }

  p {
    margin: 4px 0 0;
    color: var(--muted);
    font-size: 0.75rem;
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border-bottom: 1px solid var(--border);
  }

  .metrics div {
    padding: 12px 16px;
    border-right: 1px solid var(--border);
  }

  .metrics div:last-child {
    border-right: 0;
  }

  .metrics span {
    display: block;
    color: var(--muted);
    font-size: 0.68rem;
    margin-bottom: 4px;
  }

  .metrics strong {
    color: var(--text);
    font-size: 0.9rem;
  }

  pre {
    margin: 0;
    max-height: 34rem;
    overflow: auto;
    padding: 16px;
    color: var(--text);
    font-size: 0.72rem;
    line-height: 1.55;
    white-space: pre-wrap;
  }

  @media (max-width: 760px) {
    .viewer-head,
    .metrics {
      grid-template-columns: 1fr;
      display: grid;
    }

    .metrics div {
      border-right: 0;
      border-bottom: 1px solid var(--border);
    }
  }
</style>
