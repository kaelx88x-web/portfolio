<script lang="ts">
  import type { PageData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import SnapshotTable from '$lib/components/portfolioai/tables/SnapshotTable.svelte';

  export let data: PageData;

  $: snapshots = data.snapshots ?? [];
</script>

<PageHeader
  title="Snapshots"
  subtitle="Point-in-time portfolio state recorded after each broker sync."
  breadcrumb={[{ label: 'Portfolio', href: '/dashboard' }, { label: 'Snapshots' }]}
/>

<div class="toolbar">
  <a href="/broker" class="button-secondary">Sync to create snapshot</a>
</div>

<SnapshotTable {snapshots} />

<style>
  .toolbar { margin-bottom: 16px; }
</style>
