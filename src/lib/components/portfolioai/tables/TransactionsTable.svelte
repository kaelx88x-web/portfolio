<script lang="ts">
  import type { TransactionWithRelations } from '$lib/types/portfolio';
  import LoadingSkeleton from '../LoadingSkeleton.svelte';
  import EmptyState from '../EmptyState.svelte';
  import { money } from '$lib/format';

  export let transactions: TransactionWithRelations[] = [];
  export let loading = false;

  type TxType = 'ALL' | 'BUY' | 'SELL' | 'DIVIDEND' | 'FEE' | 'TRANSFER';
  let activeType: TxType = 'ALL';
  let page = 0;
  const PER_PAGE = 50;

  const typeStyles: Record<string, { color: string; bg: string }> = {
    BUY:      { color: '#2dd4a0', bg: 'rgba(45,212,160,0.12)'  },
    SELL:     { color: '#f96b7e', bg: 'rgba(249,107,126,0.12)' },
    DIVIDEND: { color: '#6c8fff', bg: 'rgba(108,143,255,0.12)' },
    FEE:      { color: '#7a8fb0', bg: 'rgba(122,143,176,0.1)'  },
    TRANSFER: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'   },
  };

  $: filtered = activeType === 'ALL' ? transactions : transactions.filter(t => t.type === activeType);
  $: paged = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  $: pages = Math.ceil(filtered.length / PER_PAGE);

  // Transaction uses tradeDate (not date) per Prisma schema
  function fmtDate(d: Date | string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  }
</script>

<div class="tx-bar">
  {#each ['ALL','BUY','SELL','DIVIDEND','FEE','TRANSFER'] as t}
    <button
      class="filter-chip"
      class:active={activeType === t}
      on:click={() => { activeType = t as TxType; page = 0; }}
    >{t}</button>
  {/each}
  <div style="flex:1"></div>
  <a href="/import" class="button-secondary" style="font-size:0.75rem;height:36px;padding:0 12px">Import CSV</a>
</div>

<div class="table-wrap">
  {#if loading}
    <div style="padding:16px"><LoadingSkeleton variant="table" rows={8} /></div>
  {:else if paged.length === 0}
    <EmptyState icon="⇅" title="No transactions" description="Import a CSV or sync a broker to see transactions." />
  {:else}
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Symbol</th>
          <th class="th-r">Qty</th>
          <th class="th-r">Price</th>
          <th class="th-r">Total</th>
          <th>Account</th>
        </tr>
      </thead>
      <tbody>
        {#each paged as tx}
          {@const style = typeStyles[tx.type] ?? typeStyles.FEE}
          {@const cur = tx.account?.currency ?? 'USD'}
          <tr>
            <td class="td-date">{fmtDate(tx.tradeDate)}</td>
            <td>
              <span class="type-badge" style="color:{style.color};background:{style.bg}">{tx.type}</span>
            </td>
            <td class="td-symbol">{tx.asset?.symbol ?? '—'}</td>
            <td class="td-r">{tx.quantity}</td>
            <td class="td-r">{money(tx.price, cur)}</td>
            <td class="td-r td-bold">{money(tx.quantity * tx.price, cur)}</td>
            <td class="td-account">{tx.account.name}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if pages > 1}
      <div class="tx-pager">
        <button
          class="button-secondary"
          style="height:32px;font-size:0.72rem"
          disabled={page === 0}
          on:click={() => page--}
        >← Prev</button>
        <span class="pager-info">Page {page + 1} / {pages}</span>
        <button
          class="button-secondary"
          style="height:32px;font-size:0.72rem"
          disabled={page >= pages - 1}
          on:click={() => page++}
        >Next →</button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .tx-bar { display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-bottom:12px; }
  .filter-chip { padding:4px 10px; border-radius:20px; font-size:0.65rem; font-weight:600; border:1px solid var(--border); background:none; color:var(--muted); cursor:pointer; transition:all 0.15s; }
  .filter-chip:hover { border-color:rgba(var(--primary-rgb),0.4); color:var(--text); }
  .filter-chip.active { border-color:rgba(var(--primary-rgb),0.5); background:rgba(var(--primary-rgb),0.12); color:var(--primary); }
  .type-badge { font-size:0.6rem; font-weight:700; padding:2px 7px; border-radius:20px; letter-spacing:0.05em; }
  .th-r   { text-align:right; }
  .td-r   { text-align:right; }
  .td-bold { font-weight:600; }
  .td-date    { color:var(--muted); font-size:0.75rem; }
  .td-symbol  { font-weight:700; color:var(--primary); }
  .td-account { color:var(--muted); font-size:0.72rem; }
  .pager-info { font-size:0.75rem; color:var(--muted); }
  .tx-pager { display:flex; align-items:center; gap:12px; justify-content:center; padding:12px; border-top:1px solid var(--border); }
</style>
