<script lang="ts">
  export let context: any = null;
</script>

<div class="context-status">
  <div>
    <span>Scope</span>
    <strong>{context?.scope ?? 'full'}</strong>
  </div>
  <div>
    <span>Freshness</span>
    <strong>{context?.freshness ? new Date(context.freshness).toLocaleString() : 'pending'}</strong>
  </div>
  <div>
    <span>Hash</span>
    <strong>{context?.hash ?? 'none'}</strong>
  </div>
  <div>
    <span>Missing Data</span>
    <strong>{context?.missingData?.length ?? 0}</strong>
  </div>
</div>

<style>
  .context-status {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .context-status div {
    min-width: 0;
    padding: 11px;
    border-right: 1px solid var(--border);
    background: var(--card);
  }

  .context-status div:last-child {
    border-right: 0;
  }

  span,
  strong {
    display: block;
  }

  span {
    color: var(--muted);
    font-size: 0.66rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  strong {
    margin-top: 4px;
    color: var(--text);
    font-size: 0.76rem;
    overflow-wrap: anywhere;
  }

  @media (max-width: 760px) {
    .context-status {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
