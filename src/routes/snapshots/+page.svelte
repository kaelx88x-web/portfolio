<script lang="ts">
  import type { PageData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import SnapshotTable from '$lib/components/portfolioai/tables/SnapshotTable.svelte';

  export let data: PageData;

  $: snapshots = data.snapshots ?? [];
</script>

<div class="page-top">
  <PageHeader
    title="Snapshots"
    subtitle="Point-in-time portfolio state recorded after each broker sync."
    breadcrumb={[{ label: 'Portfolio', href: '/dashboard' }, { label: 'Snapshots' }]}
  />
  <div class="page-actions">
    <a href="/broker" class="button-secondary">Sync to create snapshot</a>
  </div>
</div>

<SnapshotTable {snapshots} />

<style>
  .page-top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .page-actions { display: flex; gap: 8px; }
</style>
