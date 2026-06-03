<!-- src/lib/components/DelayedDataNotice.svelte -->
<script lang="ts">
  import { liveSettings } from '$lib/stores/live-settings';
</script>

{#if $liveSettings.showDelayedWarning}
  <p class="delayed-notice">
    Harga mungkin <strong>delayed</strong> dan berbeza ikut bursa — bukan untuk keputusan
    execution live trade. <span class="en">(Prices may be delayed and vary by exchange — not for live trade execution.)</span>
  </p>
{/if}

<style>
  .delayed-notice { font-size:.66rem; color:var(--muted); line-height:1.35; padding:6px 8px; border:1px solid var(--border); border-radius:8px; background:rgba(217,165,20,.06); }
  .en { opacity:.7; }
</style>
