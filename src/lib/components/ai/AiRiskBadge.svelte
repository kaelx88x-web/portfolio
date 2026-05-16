<script lang="ts">
  export let level = 'moderate';

  $: cls = level === 'high'
    ? 'badge-high'
    : level === 'low'
      ? 'badge-low'
      : 'badge-medium';
</script>

<span class="badge {cls}">{level.replace('_', ' ')}</span>

<style>
  .badge        { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 20px;
                  font-size: 0.62rem; font-weight: 700; text-transform: capitalize; border: 1px solid; }
  .badge-high   { background: rgba(var(--danger-rgb),0.12);  border-color: rgba(var(--danger-rgb),0.3);  color: var(--danger); }
  .badge-medium { background: rgba(var(--warning-rgb),0.12); border-color: rgba(var(--warning-rgb),0.3); color: var(--warning); }
  .badge-low    { background: rgba(var(--success-rgb),0.12); border-color: rgba(var(--success-rgb),0.3); color: var(--success); }
</style>
