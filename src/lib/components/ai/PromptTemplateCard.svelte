<script lang="ts">
  export let template: any;
</script>

<article class="template-card">
  <div class="template-top">
    <div>
      <h2>{template.name}</h2>
      <p>{template.slug}</p>
    </div>
    <span>{template.version}</span>
  </div>
  <div class="template-body">
    <div>
      <strong>System</strong>
      <p>{template.systemPrompt}</p>
    </div>
    <div>
      <strong>User Template</strong>
      <p>{template.userPromptTemplate}</p>
    </div>
  </div>
</article>

<style>
  .template-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 16px;
  }

  .template-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
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
    line-height: 1.55;
    white-space: pre-wrap;
  }

  span {
    color: var(--primary);
    font-size: 0.68rem;
    font-weight: 700;
  }

  .template-body {
    display: grid;
    gap: 12px;
  }

  strong {
    display: block;
    color: var(--text);
    font-size: 0.72rem;
    margin-bottom: 4px;
  }
</style>
