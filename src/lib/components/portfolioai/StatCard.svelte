<script lang="ts">
  export let label = '';
  export let value = '';
  export let change = '';
  export let tint: 'primary' | 'success' | 'danger' | 'warning' = 'primary';

  const tintMap = {
    primary: { rgb: '108,143,255', color: '#6c8fff' },
    success: { rgb: '45,212,160',  color: '#2dd4a0' },
    danger:  { rgb: '249,107,126', color: '#f96b7e' },
    warning: { rgb: '251,191,36',  color: '#fbbf24' },
  };

  $: t = tintMap[tint];
</script>

<div class="sc" style="--t-rgb:{t.rgb};--t-color:{t.color}">
  <div class="sc-label">{label}</div>
  <div class="sc-value">{value}</div>
  {#if change}
    <div class="sc-change">{change}</div>
  {/if}
</div>

<style>
  .sc {
    padding: 16px 18px;
    border-radius: 10px;
    border: 1px solid rgba(var(--t-rgb), 0.2);
    background: linear-gradient(135deg, rgba(var(--t-rgb), 0.08), rgba(14,24,48,0.6));
    backdrop-filter: blur(12px);
    transition: border-color 0.2s;
  }
  .sc:hover { border-color: rgba(var(--t-rgb), 0.35); }
  .sc-label  { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #7a8fb0; margin-bottom: 8px; }
  .sc-value  { font-size: 1.3rem; font-weight: 700; color: var(--t-color); letter-spacing: -0.02em; line-height: 1; }
  .sc-change { font-size: 0.7rem; color: #7a8fb0; margin-top: 6px; }
</style>
