<script lang="ts">
  import { Bot, UserRound, FileText, Code2, Sparkles } from 'lucide-svelte';
  import { marked } from 'marked';

  export let role: 'user' | 'assistant' | 'system' | 'tool' = 'assistant';
  export let content = '';

  $: isUser = role === 'user';
  let showRaw = false;

  type Parsed = {
    summary: string;
    dataShows: string[];
    risks: string[];
    considerations: string[];
    uncertainty: string;
  };

  function extractSection(text: string, heading: string): string {
    const re = new RegExp(
      `(?:^|\\n)${heading}\\s*\\n([\\s\\S]*?)(?=\\n(?:Short summary|What the data shows|Main risks|Possible actions to consider|Uncertainty note)|\\s*$)`,
      'i'
    );
    return (text.match(re)?.[1] ?? '').trim();
  }

  function toList(block: string): string[] {
    return block.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  }

  function toStringList(val: unknown): string[] {
    if (!Array.isArray(val)) return [];
    return val.filter((v): v is string => typeof v === 'string');
  }

  function parseJson(text: string): Parsed | null {
    const trimmed = text.trim();
    if (!trimmed.startsWith('{')) return null;
    try {
      const obj = JSON.parse(trimmed.split('\n\nUncertainty note')[0]);
      if (typeof obj?.summary !== 'string') return null;
      return {
        summary:        obj.summary,
        dataShows:      toStringList(obj.key_observations ?? obj.dataShows ?? []),
        risks:          toStringList(obj.risk_flags ?? obj.risks ?? []),
        considerations: toStringList(obj.considerations ?? []),
        uncertainty:    typeof obj.confidence === 'string'
                          ? `Confidence: ${obj.confidence}. This is advisory-only and cannot guarantee returns or execute trades.`
                          : '',
      };
    } catch { return null; }
  }

  function parseArticle(text: string): Parsed | null {
    if (!/short summary/i.test(text)) return null;
    return {
      summary:        extractSection(text, 'Short summary'),
      dataShows:      toList(extractSection(text, 'What the data shows')),
      risks:          toList(extractSection(text, 'Main risks')),
      considerations: toList(extractSection(text, 'Possible actions to consider')),
      uncertainty:    extractSection(text, 'Uncertainty note'),
    };
  }

  $: parsed   = isUser ? null : (parseJson(content) ?? parseArticle(content));
  $: fallback = isUser ? '' : (marked.parse(content, { async: false }) as string);
</script>

{#if isUser}
  <!-- User bubble -->
  <div class="row row-user">
    <div class="bubble bubble-human">
      <p class="user-text">{content}</p>
    </div>
    <div class="avatar avatar-human"><UserRound size={14} /></div>
  </div>

{:else}
  <!-- AI bubble -->
  <div class="row">
    <div class="avatar avatar-ai"><Bot size={14} /></div>

    <div class="bubble bubble-ai">

      {#if parsed && !showRaw}
        <!-- ── Article view ── -->
        <div class="article">

          <!-- Summary callout -->
          {#if parsed.summary}
            <div class="summary-callout">
              <div class="summary-icon"><Sparkles size={13} /></div>
              <p class="summary-text">{parsed.summary}</p>
            </div>
          {/if}

          <!-- Data shows -->
          {#if parsed.dataShows.length > 0}
            <div class="section">
              <div class="section-chip chip-blue">What the data shows</div>
              <ul class="item-list">
                {#each parsed.dataShows as item}
                  <li class="item item-blue">{item}</li>
                {/each}
              </ul>
            </div>
          {/if}

          <!-- Risks -->
          {#if parsed.risks.length > 0}
            <div class="section">
              <div class="section-chip chip-red">Main risks</div>
              <ul class="item-list">
                {#each parsed.risks as item}
                  <li class="item item-red">{item}</li>
                {/each}
              </ul>
            </div>
          {/if}

          <!-- Considerations -->
          {#if parsed.considerations.length > 0}
            <div class="section">
              <div class="section-chip chip-green">Possible actions</div>
              <ul class="item-list">
                {#each parsed.considerations as item}
                  <li class="item item-green">{item}</li>
                {/each}
              </ul>
            </div>
          {/if}

          <!-- Uncertainty -->
          {#if parsed.uncertainty}
            <div class="uncertainty">{parsed.uncertainty}</div>
          {/if}

        </div>

      {:else}
        <!-- Raw / markdown fallback -->
        <div class="md-body">{@html fallback}</div>
      {/if}

      <!-- View toggle -->
      <div class="toggle-bar">
        <button class="tog" class:tog-on={!showRaw} on:click={() => showRaw = false}>
          <FileText size={10} /> Article
        </button>
        <button class="tog" class:tog-on={showRaw} on:click={() => showRaw = true}>
          <Code2 size={10} /> Raw
        </button>
      </div>

    </div>
  </div>
{/if}

<style>
  /* Layout */
  .row       { display: flex; gap: 10px; align-items: flex-start; min-width: 0; overflow: hidden; }
  .row-user  { justify-content: flex-end; }

  .avatar    { flex-shrink: 0; width: 28px; height: 28px; border-radius: 8px;
               display: flex; align-items: center; justify-content: center; margin-top: 3px; }
  .avatar-ai   { background: rgba(var(--primary-rgb), 0.15); color: var(--primary); }
  .avatar-human{ background: var(--border); color: var(--muted); }

  .bubble    { max-width: 48rem; min-width: 0; border-radius: 12px; border: 1px solid; overflow: hidden; word-break: break-word; }
  .bubble-ai   { background: var(--card); border-color: var(--border); }
  .bubble-human{ padding: 10px 14px; background: rgba(var(--primary-rgb), 0.08);
                 border-color: rgba(var(--primary-rgb), 0.25); }

  .user-text { font-size: 0.8rem; line-height: 1.6; color: var(--text); margin: 0; }

  /* ── Article ── */
  .article { padding: 0; display: flex; flex-direction: column; }

  /* Summary callout */
  .summary-callout {
    display: flex; gap: 10px; align-items: flex-start;
    padding: 14px 16px;
    background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.1), rgba(var(--primary-rgb), 0.04));
    border-bottom: 1px solid rgba(var(--primary-rgb), 0.15);
  }
  .summary-icon {
    flex-shrink: 0; margin-top: 1px;
    color: var(--primary); opacity: 0.8;
  }
  .summary-text {
    font-size: 0.83rem; font-weight: 600; line-height: 1.6;
    color: var(--text); margin: 0;
  }

  /* Sections */
  .section { padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
  .section:last-of-type { border-bottom: none; }

  .section-chip {
    display: inline-flex; align-self: flex-start;
    font-size: 0.58rem; font-weight: 700; letter-spacing: 0.07em;
    text-transform: uppercase; padding: 2px 8px; border-radius: 20px;
  }
  .chip-blue  { background: rgba(var(--primary-rgb), 0.12); color: var(--primary); }
  .chip-red   { background: rgba(var(--danger-rgb),  0.12); color: var(--danger); }
  .chip-green { background: rgba(var(--success-rgb), 0.12); color: var(--success); }

  .item-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 5px; }

  .item {
    font-size: 0.79rem; line-height: 1.55; color: var(--text);
    padding-left: 16px; position: relative;
  }
  .item::before {
    content: ''; position: absolute; left: 3px; top: 7px;
    width: 5px; height: 5px; border-radius: 50%;
  }
  .item-blue::before  { background: var(--primary); }
  .item-red::before   { background: var(--danger); }
  .item-green::before { background: var(--success); }

  /* Uncertainty note */
  .uncertainty {
    margin: 0 16px 12px;
    font-size: 0.71rem; color: var(--muted); line-height: 1.5;
    padding: 7px 10px;
    background: rgba(var(--primary-rgb), 0.04);
    border-left: 2px solid rgba(var(--primary-rgb), 0.2);
    border-radius: 0 5px 5px 0;
  }

  /* Raw / markdown */
  .md-body { padding: 14px 16px; font-size: 0.8rem; line-height: 1.65; color: var(--text); }
  :global(.md-body p)      { margin: 0 0 8px; }
  :global(.md-body ul, .md-body ol) { padding-left: 18px; margin: 4px 0 8px; }
  :global(.md-body li)     { margin-bottom: 3px; }
  :global(.md-body strong) { font-weight: 700; }
  :global(.md-body h1, .md-body h2, .md-body h3) { font-size: 0.85rem; font-weight: 700; margin: 10px 0 4px; }
  :global(.md-body code)   { font-size: 0.75rem; background: rgba(var(--primary-rgb),0.1); padding: 1px 5px; border-radius: 3px; }

  /* Toggle bar */
  .toggle-bar {
    display: flex; gap: 2px; padding: 5px 10px;
    border-top: 1px solid var(--border);
    background: var(--surface-1);
  }
  .tog {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 8px; border-radius: 5px; border: none;
    font-size: 0.6rem; font-weight: 600; color: var(--muted);
    background: transparent; cursor: pointer; transition: background 0.15s, color 0.15s;
  }
  .tog:hover  { background: rgba(var(--primary-rgb), 0.08); color: var(--text); }
  .tog.tog-on { background: rgba(var(--primary-rgb), 0.12); color: var(--primary); }
</style>
