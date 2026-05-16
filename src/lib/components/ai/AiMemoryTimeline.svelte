<script lang="ts">
  import { date } from '$lib/format';

  export let timeline: any[] = [];
</script>

<section class="timeline">
  {#each timeline as item}
    <article class="timeline-row">
      <div class="dot"></div>
      <div>
        <div class="timeline-title">{item.timelineType?.replaceAll('_', ' ')} / {item.timelineKey?.replaceAll('_', ' ')}</div>
        <div class="timeline-value">{typeof item.value === 'object' ? JSON.stringify(item.value) : item.value}</div>
        <time>{date(item.createdAt)}</time>
      </div>
    </article>
  {/each}

  {#if timeline.length === 0}
    <div class="empty">No memory timeline yet.</div>
  {/if}
</section>

<style>
  .timeline {
    display: grid;
    gap: 10px;
  }

  .timeline-row {
    display: grid;
    grid-template-columns: 14px 1fr;
    gap: 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 12px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--primary);
    margin-top: 5px;
    box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.12);
  }

  .timeline-title {
    color: var(--text);
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: capitalize;
  }

  .timeline-value {
    margin-top: 4px;
    color: var(--muted);
    font-size: 0.75rem;
    word-break: break-word;
  }

  time,
  .empty {
    display: block;
    margin-top: 6px;
    color: var(--muted);
    font-size: 0.68rem;
  }

  .empty {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 24px;
    text-align: center;
  }
</style>
