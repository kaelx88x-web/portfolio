<script lang="ts">
  export let snapshot: any = null;
</script>

<section class="snapshot-viewer">
  <div class="viewer-head">
    <h2>Compressed Snapshot</h2>
    <span>{snapshot?.metadata?.contextHash ?? snapshot?.compressed?.context_hash ?? 'no snapshot'}</span>
  </div>
  <pre>{JSON.stringify(snapshot?.compressed ?? {}, null, 2)}</pre>
</section>

<style>
  .snapshot-viewer {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    overflow: hidden;
  }

  .viewer-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
  }

  h2 {
    margin: 0;
    color: var(--text);
    font-size: 0.9rem;
  }

  span {
    color: var(--muted);
    font-size: 0.68rem;
  }

  pre {
    margin: 0;
    max-height: 36rem;
    overflow: auto;
    padding: 16px;
    color: var(--text);
    font-size: 0.72rem;
    line-height: 1.55;
    white-space: pre-wrap;
  }
</style>
