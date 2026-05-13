<script lang="ts">
  import EmptyState from '../EmptyState.svelte';

  // Matches PortfolioSnapshot from Prisma schema:
  // snapshotDate (not createdAt), totalValue, holdingsJson, cashBalance, holdingsCount
  type Snapshot = {
    id: string;
    snapshotDate: Date | string;
    totalValue: number;
    holdingsJson: string;
    holdingsCount?: number;
    cashBalance?: number;
  };

  export let snapshots: Snapshot[] = [];
  export let loading = false;

  function money(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }
  function fmtDate(d: Date | string) {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function holdingCount(s: Snapshot): number {
    // Prefer the persisted holdingsCount if available, fall back to parsing holdingsJson
    if (s.holdingsCount != null) return s.holdingsCount;
    try { return JSON.parse(s.holdingsJson).length; } catch { return 0; }
  }
</script>

<div class="table-wrap">
  {#if loading}
    <div style="padding:16px;color:#7a8fb0;font-size:0.8rem">Loading…</div>
  {:else if snapshots.length === 0}
    <EmptyState
      icon="📸"
      title="No snapshots yet"
      description="Sync a broker to create your first snapshot."
      ctaLabel="Go to Broker Sync"
      ctaHref="/broker"
    />
  {:else}
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th class="th-r">Portfolio Value</th>
          <th class="th-r">Holdings</th>
          <th class="th-r">Cash</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each snapshots as s}
          <tr>
            <td>{fmtDate(s.snapshotDate)}</td>
            <td style="text-align:right;font-weight:700">{money(s.totalValue)}</td>
            <td style="text-align:right">{holdingCount(s)}</td>
            <td style="text-align:right">{s.cashBalance != null ? money(s.cashBalance) : '—'}</td>
            <td>
              <a href="/snapshots/{s.id}" class="action-link">View</a>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .th-r { text-align:right; }
  .action-link { font-size:0.72rem; color:#6c8fff; text-decoration:none; }
  .action-link:hover { text-decoration:underline; }
</style>
