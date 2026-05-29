<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ toggle: boolean }>();

  export let assetId: string;
  export let watchlisted: boolean;

  let pulsing = false;
  let error = false;

  async function toggle() {
    const previous = watchlisted;
    watchlisted = !watchlisted;
    dispatch('toggle', watchlisted);
    pulsing = true;
    setTimeout(() => pulsing = false, 200);

    const body = new FormData();
    body.set('assetId', assetId);

    try {
      const res = await fetch('?/toggleWatchlist', { method: 'POST', body });
      if (!res.ok) {
        watchlisted = previous;
        dispatch('toggle', watchlisted);
        error = true;
        setTimeout(() => error = false, 2000);
      }
    } catch {
      watchlisted = previous;
      dispatch('toggle', watchlisted);
      error = true;
      setTimeout(() => error = false, 2000);
    }
  }
</script>

<div class="wl-wrap">
  <button
    class="wl-btn"
    class:active={watchlisted}
    class:pulse={pulsing}
    on:click|stopPropagation={toggle}
    title={watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
    aria-label={watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
  >
    {watchlisted ? '★' : '☆'}
  </button>
  {#if error}
    <span class="wl-error">Failed</span>
  {/if}
</div>

<style>
  .wl-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  .wl-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    color: var(--muted);
    padding: 2px 4px;
    border-radius: 4px;
    transition: color 0.15s, transform 0.15s;
    line-height: 1;
  }
  .wl-btn.active { color: var(--warning); }
  .wl-btn:hover  { color: var(--warning); }
  .wl-btn.pulse  { transform: scale(1.35); }
  .wl-error {
    font-size: 0.62rem;
    color: var(--danger);
    position: absolute;
    top: 100%;
    right: 0;
    white-space: nowrap;
  }
</style>
