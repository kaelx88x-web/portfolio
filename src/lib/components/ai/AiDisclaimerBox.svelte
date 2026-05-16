<script lang="ts">
  import { ShieldAlert } from 'lucide-svelte';
</script>

<div class="disclaimer">
  <div class="disclaimer-title">
    <ShieldAlert size={15} />
    Advisory only
  </div>
  <p class="disclaimer-body">
    Copilot explains portfolio data and uncertainty. It does not place trades, guarantee returns, or replace licensed financial advice.
  </p>
</div>

<style>
  .disclaimer       { background: rgba(var(--warning-rgb),0.07); border: 1px solid rgba(var(--warning-rgb),0.25); border-radius: 10px; padding: 14px 16px; }
  .disclaimer-title { display: flex; align-items: center; gap: 7px; font-size: 0.8rem; font-weight: 700; color: var(--warning); margin-bottom: 8px; }
  .disclaimer-body  { font-size: 0.75rem; color: var(--muted); line-height: 1.6; margin: 0; }
</style>
