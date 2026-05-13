<script lang="ts">
  export let title = '';
  export let subtitle = '';
  export let breadcrumb: { label: string; href?: string }[] = [];
</script>

<div class="ph">
  {#if breadcrumb.length > 0}
    <nav class="ph-breadcrumb">
      {#each breadcrumb as crumb, i}
        {#if i > 0}<span class="ph-sep">/</span>{/if}
        {#if crumb.href}
          <a href={crumb.href} class="ph-crumb-link">{crumb.label}</a>
        {:else}
          <span class="ph-crumb-current">{crumb.label}</span>
        {/if}
      {/each}
    </nav>
  {/if}
  <h1 class="ph-title">{title}</h1>
  {#if subtitle}<p class="ph-subtitle">{subtitle}</p>{/if}
</div>

<style>
  .ph { margin-bottom: 24px; }
  .ph-breadcrumb { display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
  .ph-sep { color: #1a2038; font-size: 0.75rem; }
  .ph-crumb-link { font-size: 0.72rem; color: #7a8fb0; text-decoration: none; }
  .ph-crumb-link:hover { color: #6c8fff; }
  .ph-crumb-current { font-size: 0.72rem; color: #dce8ff; }
  .ph-title { font-size: 1.4rem; font-weight: 700; color: #dce8ff; margin: 0; }
  .ph-subtitle { font-size: 0.8rem; color: #7a8fb0; margin: 4px 0 0; }
</style>
