<script lang="ts">
  export let timeline: any[] = [];
</script>

<div class="timeline">
  {#each timeline as item}
    <article>
      <span>{item.label}</span>
      <h3>{item.title}</h3>
      <p>{item.detail}</p>
    </article>
  {/each}
</div>

<style>
  .timeline {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  article {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 12px;
  }

  span {
    color: var(--primary);
    font-size: 0.66rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  h3 {
    margin: 5px 0;
    color: var(--text);
    font-size: 0.84rem;
    text-transform: capitalize;
  }

  p {
    margin: 0;
    color: var(--muted);
    font-size: 0.72rem;
    line-height: 1.45;
  }

  @media (max-width: 900px) {
    .timeline {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
