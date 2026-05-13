<script lang="ts">
  export let icon  = '◎';
  export let title = 'Nothing here yet';
  export let description = '';
  export let ctaLabel: string | null = null;
  export let ctaHref: string | null = null;
</script>

<div class="empty">
  <div class="empty-icon">{icon}</div>
  <div class="empty-title">{title}</div>
  {#if description}
    <div class="empty-desc">{description}</div>
  {/if}
  {#if ctaLabel && ctaHref}
    <a href={ctaHref} class="button" style="margin-top:16px">{ctaLabel}</a>
  {/if}
</div>

<style>
  .empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:48px 24px; text-align:center; }
  .empty-icon  { font-size:2rem; margin-bottom:12px; color:#1a2038; }
  .empty-title { font-size:0.9rem; font-weight:600; color:#dce8ff; margin-bottom:6px; }
  .empty-desc  { font-size:0.8rem; color:#7a8fb0; max-width:320px; line-height:1.6; }
</style>
