<script lang="ts">
  import { ShieldAlert } from 'lucide-svelte';
  export let warnings: string[] = [];
  export let mode = 'read_only_real';
</script>

<section class="banner">
  <ShieldAlert size={18} />
  <div>
    <strong>{mode === 'sandbox_paper' ? 'Sandbox Risk Analysis' : 'Read-Only Risk Analysis'}</strong>
    <p>{warnings[0] ?? 'Risk Advisor is monitoring portfolio risk from available context only.'}</p>
  </div>
</section>

<style>
  .banner {
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr);
    gap: 10px;
    border: 1px solid rgba(var(--warning-rgb), 0.34);
    border-radius: 8px;
    background: rgba(var(--warning-rgb), 0.08);
    color: var(--warning);
    padding: 12px;
  }
  strong { display: block; color: var(--text); font-size: 0.82rem; }
  p { margin: 4px 0 0; color: var(--muted); font-size: 0.74rem; line-height: 1.45; }
</style>
