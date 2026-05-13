<script lang="ts">
  export let title = '';
  export let summary = '';
  export let signal: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  export let href = '';

  const signalMap = {
    low:      { label: 'Low',      color: '#2dd4a0', bg: 'rgba(45,212,160,0.1)' },
    medium:   { label: 'Medium',   color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
    high:     { label: 'High',     color: '#f96b7e', bg: 'rgba(249,107,126,0.1)' },
    critical: { label: 'Critical', color: '#f96b7e', bg: 'rgba(249,107,126,0.18)' },
  };

  $: s = signalMap[signal];
</script>

<div class="ic">
  <div class="ic-header">
    <span class="ic-title">{title}</span>
    <span class="ic-signal" style="color:{s.color};background:{s.bg}">{s.label}</span>
  </div>
  <p class="ic-summary">{summary}</p>
  {#if href}
    <a href={href} class="ic-link">View Details →</a>
  {/if}
</div>

<style>
  .ic { padding: 16px; border-radius: 10px; border: 1px solid rgba(108,143,255,0.2); background: #0e1830; display: flex; flex-direction: column; gap: 8px; }
  .ic-header { display: flex; align-items: center; justify-content: space-between; }
  .ic-title  { font-size: 0.75rem; font-weight: 700; color: #6c8fff; }
  .ic-signal { font-size: 0.6rem; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.06em; }
  .ic-summary{ font-size: 0.78rem; color: #7a8fb0; line-height: 1.5; margin: 0; }
  .ic-link   { font-size: 0.72rem; color: #6c8fff; text-decoration: none; align-self: flex-start; }
  .ic-link:hover { text-decoration: underline; }
</style>
