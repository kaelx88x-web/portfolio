<script lang="ts">
  import type { ComponentType } from 'svelte';

  export let label = '';
  export let value = '';
  export let change = '';
  export let tooltip = '';
  export let tint: 'primary' | 'success' | 'danger' | 'warning' = 'primary';
  export let tone: 'cyan' | 'emerald' | 'amber' | 'rose' | undefined = undefined;
  export let icon: ComponentType | null = null;

  const tintMap = {
    primary: { rgb: '108,143,255', color: '#6c8fff' },
    success: { rgb: '45,212,160',  color: '#2dd4a0' },
    danger:  { rgb: '249,107,126', color: '#f96b7e' },
    warning: { rgb: '251,191,36',  color: '#fbbf24' },
  };

  const toneMap = {
    cyan: 'primary',
    emerald: 'success',
    amber: 'warning',
    rose: 'danger',
  } satisfies Record<NonNullable<typeof tone>, keyof typeof tintMap>;

  $: resolvedTint = tone ? toneMap[tone] : tint;
  $: t = tintMap[resolvedTint];
</script>

<div class="sc" style="--t-rgb:{t.rgb};--t-color:{t.color}">
  <div class="sc-head">
    <div class="sc-label">
      {label}
      {#if tooltip}
        <span class="sc-tooltip-icon" title={tooltip}>?</span>
      {/if}
    </div>
    {#if icon}
      <svelte:component this={icon} size={18} strokeWidth={2} class="sc-icon" />
    {/if}
  </div>
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
    background: linear-gradient(135deg, rgba(var(--t-rgb), 0.08), var(--glass-bg));
    backdrop-filter: blur(12px);
    transition: border-color 0.2s;
  }
  .sc:hover { border-color: rgba(var(--t-rgb), 0.35); }
  .sc-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .sc-label  { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 8px; }
  .sc-head .sc-label { margin-bottom: 0; }
  :global(.sc-icon) { color: var(--t-color); opacity: 0.86; flex: 0 0 auto; }
  .sc-value  { font-size: 1.3rem; font-weight: 700; color: var(--t-color); letter-spacing: -0.02em; line-height: 1; }
  .sc-change { font-size: 0.7rem; color: var(--muted); margin-top: 6px; }
  .sc-tooltip-icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 13px; height: 13px; border-radius: 50%;
    background: rgba(var(--primary-rgb),0.15); color: var(--primary);
    font-size: 0.55rem; font-weight: 700; cursor: help;
    margin-left: 4px; vertical-align: middle;
    border: 1px solid rgba(var(--primary-rgb),0.3);
  }
</style>
