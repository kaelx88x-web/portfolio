<!-- Unavailable.svelte -->
<script lang="ts">export let label = 'Data'; </script>
<div class="na"><span>{label}</span><b>Data Not Available</b></div>
<style>
  .na { display:flex; flex-direction:column; gap:2px; padding:14px; background:var(--card); border:1px solid var(--border); border-radius:10px; }
  .na span { font-size:.62rem; text-transform:uppercase; letter-spacing:.4px; color:var(--muted); }
  .na b { font-size:.82rem; color:var(--muted); font-weight:600; }
</style>
