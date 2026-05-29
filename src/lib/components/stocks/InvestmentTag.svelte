<script lang="ts">
  export let tag: string;

  const TAG_STYLES: Record<string, { bg: string; color: string }> = {
    'Dividend':          { bg: 'rgba(45,212,160,0.12)',  color: 'var(--success)' },
    'Growth':            { bg: 'rgba(108,143,255,0.12)', color: 'var(--primary)' },
    'AI':                { bg: 'rgba(139,92,246,0.15)',  color: '#a78bfa' },
    'ETF':               { bg: 'rgba(108,143,255,0.08)', color: 'var(--muted)' },
    'Beginner Friendly': { bg: 'rgba(45,212,160,0.08)',  color: 'var(--success)' },
    'High Risk':         { bg: 'rgba(249,107,126,0.12)', color: 'var(--danger)' },
    'Defensive':         { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
    'Diversified':       { bg: 'rgba(122,143,176,0.12)', color: 'var(--muted)' },
    'Income':            { bg: 'rgba(45,212,160,0.12)',  color: 'var(--success)' },
    'Energy':            { bg: 'rgba(251,191,36,0.12)',  color: 'var(--warning)' },
    'Finance':           { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
    'Healthcare':        { bg: 'rgba(45,212,160,0.10)',  color: 'var(--success)' },
    'Technology':        { bg: 'rgba(108,143,255,0.12)', color: 'var(--primary)' },
    'Utilities':         { bg: 'rgba(251,191,36,0.10)',  color: 'var(--warning)' },
    'International':     { bg: 'rgba(122,143,176,0.12)', color: 'var(--muted)' },
    'Streaming':         { bg: 'rgba(249,107,126,0.10)', color: 'var(--danger)' },
    'Consumer':          { bg: 'rgba(122,143,176,0.10)', color: 'var(--muted)' },
    'EV':                { bg: 'rgba(45,212,160,0.12)',  color: 'var(--success)' },
  };

  $: style = TAG_STYLES[tag] ?? { bg: 'rgba(122,143,176,0.1)', color: 'var(--muted)' };
</script>

<span class="tag" style="background:{style.bg};color:{style.color}">{tag}</span>

<style>
  .tag {
    display: inline-block;
    font-size: 0.62rem;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
    letter-spacing: 0.02em;
  }
</style>
