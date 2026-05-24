<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  const bal = data.balance;
  const pos = data.positions;

  interface FundPosition {
    fund_market: string;
    symbol: string;
    name: string;
    quantity: number | null;
    average_cost: number | null;
    market_price: number | null;
    market_value: number | null;
    unrealized_pl: number | null;
    unrealized_pl_pct: number | null;
    currency: string;
  }

  const FUND_LABELS: Record<string, string> = {
    MYFUND: 'Malaysia (MYFUND)',
    USFUND: 'US Mutual Funds',
    HKFUND: 'Hong Kong (HKFUND)',
    SGFUND: 'Singapore (SGFUND)',
    JPFUND: 'Japan (JPFUND)',
  };

  const allPositions: FundPosition[] = pos?.positions ?? [];
  const fundMarkets: string[] = [...new Set(allPositions.map((p) => p.fund_market))];

  function positionsByMarket(market: string): FundPosition[] {
    return allPositions.filter((p) => p.fund_market === market);
  }

  function fmt(n: number | null | undefined, decimals = 2): string {
    if (n === null || n === undefined) return '—';
    return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function fmtPl(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return (n >= 0 ? '+' : '') + fmt(n);
  }

  function isPos(n: number | null | undefined): boolean {
    return n !== null && n !== undefined && n > 0;
  }
  function isNeg(n: number | null | undefined): boolean {
    return n !== null && n !== undefined && n < 0;
  }

  const enabledMarkets = [
    bal?.has_myfund && 'MY',
    bal?.has_usfund && 'US',
    bal?.has_hkfund && 'HK',
    bal?.has_sgfund && 'SG',
    bal?.has_jpfund && 'JP',
  ].filter(Boolean).join(' · ');
</script>

<PageHeader
  title="Fund Balance"
  subtitle="Multi-currency balances and fund positions from Moomoo."
  breadcrumb={[{ label: 'Fund Balance' }]}
/>

{#if data.error}
  <div class="error-bar">{data.error}</div>
{/if}

{#if bal}
  <!-- Account info row -->
  <div class="account-row">
    <div class="account-chip">
      <span class="chip-label">Account</span>
      <span class="chip-val">{bal.account_number || '—'}</span>
    </div>
    <div class="account-chip">
      <span class="chip-label">Environment</span>
      <span class="chip-val" class:real={bal.trade_environment === 'REAL'}>{bal.trade_environment}</span>
    </div>
    <div class="account-chip">
      <span class="chip-label">Fund Markets</span>
      <span class="chip-val">{enabledMarkets || '—'}</span>
    </div>
  </div>

  <!-- Balances grid -->
  <div class="section-title">Account Balances</div>
  {#if bal.balances && bal.balances.length > 0}
    <div class="balances-grid">
      {#each bal.balances as b}
        <div class="bal-card">
          <div class="bal-currency">{b.currency}</div>
          <div class="bal-total">{b.currency} {fmt(b.total_assets)}</div>
          <div class="bal-rows">
            <div class="bal-row">
              <span class="bal-label">Cash</span>
              <span class="bal-val">{fmt(b.cash)}</span>
            </div>
            <div class="bal-row">
              <span class="bal-label">Securities</span>
              <span class="bal-val">{fmt(b.securities_assets)}</span>
            </div>
            <div class="bal-row">
              <span class="bal-label">Market Val</span>
              <span class="bal-val">{fmt(b.market_val)}</span>
            </div>
            <div class="bal-row">
              <span class="bal-label">Unrealized P/L</span>
              <span class="bal-val" class:pos={isPos(b.unrealized_pl)} class:neg={isNeg(b.unrealized_pl)}>
                {fmtPl(b.unrealized_pl)}
              </span>
            </div>
            <div class="bal-row">
              <span class="bal-label">Buying Power</span>
              <span class="bal-val">{fmt(b.buying_power)}</span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty">No non-zero balances found.</div>
  {/if}
{/if}

{#if allPositions.length > 0}
  <div class="section-title" style="margin-top: 24px;">Fund Positions ({pos.count})</div>

  {#each fundMarkets as market}
    {@const items = positionsByMarket(market)}
    <div class="fund-group">
      <div class="fund-group-label">{FUND_LABELS[market] ?? market}</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Name</th>
              <th class="right">Qty</th>
              <th class="right">Avg Cost</th>
              <th class="right">Mkt Price</th>
              <th class="right">Mkt Value</th>
              <th class="right">Unrealized P/L</th>
              <th class="right">Return %</th>
            </tr>
          </thead>
          <tbody>
            {#each items as p}
              <tr>
                <td class="ticker">{p.symbol}</td>
                <td class="name-cell">{p.name || '—'}</td>
                <td class="right">{fmt(p.quantity, 4)}</td>
                <td class="right">{fmt(p.average_cost, 4)}</td>
                <td class="right">{fmt(p.market_price, 4)}</td>
                <td class="right font-med">{p.currency} {fmt(p.market_value)}</td>
                <td class="right" class:pos={isPos(p.unrealized_pl)} class:neg={isNeg(p.unrealized_pl)}>
                  {fmtPl(p.unrealized_pl)}
                </td>
                <td class="right" class:pos={isPos(p.unrealized_pl_pct)} class:neg={isNeg(p.unrealized_pl_pct)}>
                  {p.unrealized_pl_pct !== null ? fmtPl((p.unrealized_pl_pct ?? 0) * 100) + '%' : '—'}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/each}

{:else if pos && pos.count === 0}
  <div class="section-title" style="margin-top: 24px;">Fund Positions</div>
  <div class="empty">No fund positions found.</div>
{/if}

{#if !bal && !pos && !data.error}
  <div class="empty">Could not connect to Moomoo service. Make sure it is running on port 8001.</div>
{/if}

<style>
  .error-bar {
    padding: 10px 14px; border-radius: 8px; margin-bottom: 16px;
    background: rgba(var(--danger-rgb),0.08); border: 1px solid rgba(var(--danger-rgb),0.25);
    color: var(--danger); font-size: 0.8rem;
  }

  .account-row {
    display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;
  }
  .account-chip {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 12px; border-radius: 20px;
    background: var(--surface-1); border: 1px solid var(--border);
    font-size: 0.75rem;
  }
  .chip-label { color: var(--muted); }
  .chip-val { font-weight: 600; color: var(--text); }
  .chip-val.real { color: var(--success); }

  .section-title {
    font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--muted); margin-bottom: 10px;
  }

  .balances-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
    margin-bottom: 4px;
  }

  .bal-card {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; padding: 16px;
  }
  .bal-currency {
    font-size: 0.6rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--muted); margin-bottom: 4px;
  }
  .bal-total {
    font-size: 1.05rem; font-weight: 700; color: var(--text); margin-bottom: 12px;
  }
  .bal-rows { display: flex; flex-direction: column; gap: 6px; }
  .bal-row { display: flex; justify-content: space-between; align-items: center; }
  .bal-label { font-size: 0.7rem; color: var(--muted); }
  .bal-val { font-size: 0.78rem; font-weight: 500; color: var(--text); }

  .fund-group { margin-bottom: 20px; }
  .fund-group-label {
    font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--muted); margin-bottom: 8px;
  }

  .table-wrap { border-radius: 10px; overflow: hidden; overflow-x: auto; }
  .right { text-align: right !important; }
  .ticker { font-weight: 700; color: var(--primary); }
  .name-cell { color: var(--muted); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .font-med { font-weight: 600; }

  .pos { color: var(--success) !important; }
  .neg { color: var(--danger) !important; }

  .empty { color: var(--muted); font-size: 0.83rem; padding: 40px; text-align: center; }
</style>
