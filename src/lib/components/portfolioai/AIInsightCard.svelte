<script lang="ts">
  export let title = '';
  export let summary = '';
  export let signal: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  export let href = '';
  export let confidence = '';
  export let risk = '';
  export let action = '';

  const signalMap = {
    low:      { label: 'Low',      color: '#2dd4a0', bg: 'rgba(45,212,160,0.1)' },
    medium:   { label: 'Medium',   color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
    high:     { label: 'High',     color: '#f96b7e', bg: 'rgba(249,107,126,0.1)' },
    critical: { label: 'Critical', color: '#f96b7e', bg: 'rgba(249,107,126,0.18)' },
  };

  $: normalizedRisk = risk.toLowerCase() as keyof typeof signalMap;
  $: resolvedSignal = normalizedRisk in signalMap ? normalizedRisk : signal;
  $: s = signalMap[resolvedSignal];
</script>

<div class="ic">
  <div class="ic-header">
    <span class="ic-title">{title}</span>
    <span class="ic-signal" style="color:{s.color};background:{s.bg}">{s.label}</span>
  </div>
  <p class="ic-summary">{summary}</p>
  {#if confidence || action}
    <div class="ic-meta">
      {#if confidence}<span>{confidence}</span>{/if}
      {#if action}<span>{action}</span>{/if}
    </div>
  {/if}
  {#if href}
    <a href={href} class="ic-link">View Details →</a>
  {/if}
</div>

<style>
  .ic { padding: 16px; border-radius: 10px; border: 1px solid var(--ai-border); background: var(--card); display: flex; flex-direction: column; gap: 8px; }
  .ic-header { display: flex; align-items: center; justify-content: space-between; }
  .ic-title  { font-size: 0.75rem; font-weight: 700; color: var(--primary); }
  .ic-signal { font-size: 0.6rem; font-weight: 700; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.06em; }
  .ic-summary{ font-size: 0.78rem; color: var(--muted); line-height: 1.5; margin: 0; }
  .ic-meta   { display:flex; flex-wrap:wrap; gap:6px; }
  .ic-meta span { border:1px solid rgba(var(--primary-rgb),0.18); border-radius:999px; padding:2px 8px; font-size:0.65rem; color:var(--text); background:rgba(var(--primary-rgb),0.08); }
  .ic-link   { font-size: 0.72rem; color: var(--primary); text-decoration: none; align-self: flex-start; }
  .ic-link:hover { text-decoration: underline; }
</style>
