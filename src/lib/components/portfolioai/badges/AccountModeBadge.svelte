<script lang="ts">
  export let mode: 'LIVE READ-ONLY' | 'SANDBOX' | 'MANUAL' = 'MANUAL';
</script>

{#if mode === 'LIVE READ-ONLY'}
  <span class="badge badge-danger">LIVE · READ ONLY</span>
{:else if mode === 'SANDBOX'}
  <span class="badge badge-warning">SANDBOX</span>
{:else}
  <span class="badge badge-muted">MANUAL</span>
{/if}

<style>
  .badge {
    display: inline-flex; align-items: center;
    padding: 2px 8px; border-radius: 20px;
    font-size: 0.6rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
  }
  .badge-danger  { background: rgba(249,107,126,0.12); color: #f96b7e; }
  .badge-warning { background: rgba(251,191,36,0.12);  color: #fbbf24; }
  .badge-muted   { background: rgba(122,143,176,0.12); color: #7a8fb0; }
</style>
