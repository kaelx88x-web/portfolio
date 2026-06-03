<!-- src/lib/components/LiveDot.svelte -->
<script lang="ts">
  import { liveEnabled } from '$lib/stores/live-toggle';
  import { liveQuotes } from '$lib/stores/live-quotes';
  export let code: string;
  $: q = $liveQuotes.get(code.trim().toUpperCase());
  $: label = !$liveEnabled ? 'Off'
    : q?.stale ? 'Delayed'
    : q?.session === 'pre' ? 'Pre-market'
    : q?.session === 'post' ? 'After-hours'
    : q?.session === 'closed' ? 'Closed'
    : q ? 'Live' : 'Live';
  $: tone = label === 'Live' ? 'live' : label === 'Delayed' ? 'warn' : label === 'Off' ? 'off' : 'muted';
</script>

<span class="livedot {tone}" title={label}>
  <span class="dot" class:pulse={label === 'Live'}></span>
  <span class="lbl">{label}</span>
</span>

<style>
  .livedot { display:inline-flex; align-items:center; gap:5px; font-size:.62rem; font-weight:600; color:var(--muted); }
  .dot { width:7px; height:7px; border-radius:50%; background:var(--muted); flex:none; }
  .live .dot { background:var(--success, #30a46c); } .warn .dot { background:var(--warning, #d9a514); } .off .dot { background:var(--border); }
  .pulse { animation:p 1.6s ease-in-out infinite; } @keyframes p { 0%,100%{opacity:1;} 50%{opacity:.35;} }
  @media (max-width:767px) { .lbl { display:none; } } /* dot-only on mobile so rows never overflow */
</style>
