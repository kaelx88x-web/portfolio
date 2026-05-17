<!-- src/lib/components/optimization/OptimizationHubCard.svelte -->
<script lang="ts">
  export let icon: string;
  export let name: string;
  export let description: string;
  export let badge = '';
  export let badgeColor: 'green' | 'amber' | 'blue' = 'blue';
  export let href: string;
</script>

<a {href} class="hub-card">
  <span class="icon">{icon}</span>
  <strong class="name">{name}</strong>
  <p class="desc">{description}</p>
  {#if badge}
    <span class="badge" class:green={badgeColor === 'green'} class:amber={badgeColor === 'amber'}>{badge}</span>
  {/if}
</a>

<style>
  .hub-card { display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 16px; text-decoration: none; transition: border-color 0.15s; }
  .hub-card:hover { border-color: var(--primary); }
  .icon { font-size: 1.4rem; }
  .name { font-size: 0.84rem; font-weight: 800; color: var(--text); }
  .desc { margin: 0; font-size: 0.69rem; color: var(--muted); line-height: 1.5; flex: 1; }
  .badge { align-self: flex-start; font-size: 0.6rem; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 999px; background: rgba(var(--primary-rgb), 0.1); color: var(--primary); }
  .badge.green { background: rgba(var(--success-rgb), 0.1); color: var(--success); }
  .badge.amber { background: rgba(var(--warning-rgb), 0.1); color: var(--warning); }
</style>
