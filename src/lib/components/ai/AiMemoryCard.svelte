<script lang="ts">
  import { date, money, number, percent } from '$lib/format';

  export let memory: any = null;
</script>

{#if memory}
  <article class="memory-card">
    <div class="memory-head">
      <h2>{memory.snapshotType?.replaceAll('_', ' ')}</h2>
      <p>{memory.summary}</p>
    </div>

    <div class="memory-grid">
      <div>
        <span>Value</span>
        <strong>{money(memory.compressed?.portfolio?.total_value ?? 0)}</strong>
      </div>
      <div>
        <span>Risk</span>
        <strong>{memory.compressed?.risk?.risk_level ?? 'unknown'}</strong>
      </div>
      <div>
        <span>Health</span>
        <strong>{number(memory.compressed?.risk?.health_score ?? 0, 0)}</strong>
      </div>
      <div>
        <span>Cash</span>
        <strong>{percent(memory.compressed?.portfolio?.cash_ratio ?? 0)}</strong>
      </div>
    </div>

    <div class="memory-foot">
      <span>{memory.metadata?.contextHash ?? memory.compressed?.context_hash}</span>
      <time>{date(memory.createdAt)}</time>
    </div>
  </article>
{:else}
  <article class="memory-card empty">
    <h2>No memory snapshot yet</h2>
    <p>Refresh memory to store a compressed portfolio intelligence snapshot.</p>
  </article>
{/if}

<style>
  .memory-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 16px;
  }

  .memory-card.empty {
    display: grid;
    place-content: center;
    min-height: 180px;
    text-align: center;
  }

  .memory-head {
    margin-bottom: 14px;
  }

  h2 {
    margin: 0;
    color: var(--text);
    font-size: 0.95rem;
    text-transform: capitalize;
  }

  p {
    margin: 5px 0 0;
    color: var(--muted);
    font-size: 0.75rem;
    line-height: 1.55;
  }

  .memory-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .memory-grid div {
    padding: 12px;
    border-right: 1px solid var(--border);
  }

  .memory-grid div:last-child {
    border-right: 0;
  }

  span {
    display: block;
    color: var(--muted);
    font-size: 0.68rem;
  }

  strong {
    display: block;
    color: var(--text);
    font-size: 0.9rem;
    margin-top: 4px;
    text-transform: capitalize;
  }

  .memory-foot {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 12px;
    color: var(--muted);
    font-size: 0.7rem;
  }

  @media (max-width: 760px) {
    .memory-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .memory-grid div:nth-child(2) {
      border-right: 0;
    }
  }
</style>
