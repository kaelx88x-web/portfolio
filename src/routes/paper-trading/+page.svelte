<script lang="ts">
  import { onMount } from 'svelte';
  import { FlaskConical, RefreshCw, TrendingUp, TrendingDown, DollarSign, BarChart2, AlertTriangle, Terminal, MonitorCheck, Wifi, RotateCcw, ServerCrash, Radio } from 'lucide-svelte';
  import { PUBLIC_APP_MODE } from '$env/static/public';

  const isSaas = PUBLIC_APP_MODE === 'saas';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import { portfolioSummary } from '$lib/stores/portfolio-summary';
  import type { PageData } from './$types';

  export let data: PageData;

  $: paper = data.paper;
  $: info  = paper.account_info;
  $: positions = paper.positions ?? [];
  $: orders    = paper.orders ?? [];
  $: deals     = paper.deals ?? [];
  $: fromAgent = (paper as Record<string, unknown>).from_agent as boolean ?? false;
  $: agentPushedAt = (paper as Record<string, unknown>).agent_pushed_at as string | null ?? null;

  // Update topbar with paper account values
  $: portfolioSummary.set({
    totalValue:   info.total_assets ?? 0,
    dayChange:    0,
    dayChangePct: 0,
    accountName:  'Moomoo Simulate',
    accountMode:  'SANDBOX',
  });

  function money(n: number, currency = 'USD') {
    return n.toLocaleString('en-US', { style: 'currency', currency, minimumFractionDigits: 2 });
  }
  function pct(n: number) {
    return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmt(n: number) {
    return (n >= 0 ? '+' : '') + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function statusClass(s: string) {
    const u = s.toUpperCase();
    if (u.includes('FILL')) return 'filled';
    if (u.includes('CANCEL')) return 'cancelled';
    if (u.includes('SUBMIT') || u.includes('QUEUE')) return 'pending';
    return 'other';
  }

  function formatDate(iso: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
</script>

<PageHeader
  title="Paper Trading"
  subtitle="Moomoo simulate account — live positions, orders and trade history."
  breadcrumb={[{ label: 'Paper Trading' }]}
/>

{#if paper.error}
  {#if isSaas}
    <div class="conn-error-card saas-unavail">
      <div class="conn-error-header">
        <ServerCrash size={15} />
        <span>Paper trading data unavailable</span>
      </div>
      {#if paper.error?.includes('Settings > Agent')}
        <p class="conn-error-intro">No data from your local agent yet. Set up the agent on your PC to push data here.</p>
        <a href="/settings/agent" class="support-link">Go to Settings → Agent →</a>
      {:else}
        <p class="conn-error-intro">{paper.error ?? 'The paper trading service is temporarily unreachable. Please try again in a few minutes.'}</p>
        <a href="mailto:support@portfolioai.app" class="support-link">Contact support →</a>
      {/if}
    </div>
  {:else}
    <div class="conn-error-card">
      <div class="conn-error-header">
        <AlertTriangle size={16} />
        <span>Cannot connect to Moomoo bridge</span>
        <code class="conn-error-msg">{paper.error}</code>
      </div>

      <p class="conn-error-intro">Follow these steps to restore the connection:</p>

      <ol class="conn-steps">
        <li>
          <span class="step-icon"><MonitorCheck size={14} /></span>
          <div>
            <strong>Open Moomoo OpenD</strong>
            <span class="step-detail">Launch the <em>OpenD</em> desktop app and make sure it shows <em>"Connected"</em>. Log in if prompted.</span>
          </div>
        </li>
        <li>
          <span class="step-icon"><Terminal size={14} /></span>
          <div>
            <strong>Start the moomoo-service</strong>
            <span class="step-detail">In a terminal at the project root, run:</span>
            <pre class="conn-cmd">cd moomoo-service
python main.py</pre>
            <span class="step-detail">You should see <em>"Uvicorn running on http://127.0.0.1:8001"</em>.</span>
          </div>
        </li>
        <li>
          <span class="step-icon"><Wifi size={14} /></span>
          <div>
            <strong>Check port 8001 is free</strong>
            <span class="step-detail">If another process is using port 8001, stop it first. On Windows:</span>
            <pre class="conn-cmd">netstat -ano | findstr :8001
taskkill /PID &lt;pid&gt; /F</pre>
          </div>
        </li>
        <li>
          <span class="step-icon"><RotateCcw size={14} /></span>
          <div>
            <strong>Refresh this page</strong>
            <span class="step-detail">Once OpenD and moomoo-service are both running, reload to fetch live data.</span>
          </div>
        </li>
      </ol>
    </div>
  {/if}
{/if}

{#if fromAgent && agentPushedAt}
  <div class="agent-badge">
    <Radio size={11} />
    Agent data — pushed {formatDate(agentPushedAt)}
  </div>
{/if}

<!-- ── Account badge ───────────────────────────────────────────── -->
<div class="account-bar">
  <FlaskConical size={13} />
  <span class="acc-label">{paper.account.account_label}</span>
  <span class="sim-badge">SIMULATE</span>
  <span class="acc-meta">acc {paper.account.broker_account_id} · {paper.account.trdmarket_auth.join(', ')}</span>
  <span class="sync-time">Synced {formatDate(paper.synced_at)}</span>
</div>

<!-- ── Stat cards ─────────────────────────────────────────────── -->
<div class="stats">
  <div class="stat-card">
    <div class="stat-icon"><DollarSign size={15} /></div>
    <div class="stat-body">
      <div class="stat-label">Total Assets</div>
      <div class="stat-value">{money(info.total_assets)}</div>
    </div>
  </div>
  <div class="stat-card">
    <div class="stat-icon"><BarChart2 size={15} /></div>
    <div class="stat-body">
      <div class="stat-label">Securities</div>
      <div class="stat-value">{money(info.market_val)}</div>
    </div>
  </div>
  <div class="stat-card">
    <div class="stat-icon"><DollarSign size={15} /></div>
    <div class="stat-body">
      <div class="stat-label">Cash</div>
      <div class="stat-value">{money(info.cash)}</div>
    </div>
  </div>
  <div class="stat-card">
    <div class="stat-icon" class:up={info.unrealized_pl >= 0} class:down={info.unrealized_pl < 0}>
      {#if info.unrealized_pl >= 0}<TrendingUp size={15} />{:else}<TrendingDown size={15} />{/if}
    </div>
    <div class="stat-body">
      <div class="stat-label">Unrealized P&L</div>
      <div class="stat-value" class:positive={info.unrealized_pl >= 0} class:negative={info.unrealized_pl < 0}>
        {fmt(info.unrealized_pl)}
      </div>
    </div>
  </div>
</div>

<!-- ── Positions ──────────────────────────────────────────────── -->
<section class="section">
  <div class="section-header">
    <h2 class="section-title">Positions <span class="count">{positions.length}</span></h2>
  </div>

  {#if positions.length === 0}
    <div class="empty">No open positions in simulate account.</div>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Name</th>
            <th class="num">Qty</th>
            <th class="num">Avg Cost</th>
            <th class="num">Mkt Price</th>
            <th class="num">Mkt Value</th>
            <th class="num">Unrealized P&L</th>
            <th class="num">P&L %</th>
          </tr>
        </thead>
        <tbody>
          {#each positions as pos}
            <tr>
              <td class="sym">{pos.symbol.replace(/^HK\.|^US\./, '')}</td>
              <td class="name">{pos.name}</td>
              <td class="num">{pos.quantity.toLocaleString()}</td>
              <td class="num">{pos.average_cost.toFixed(3)}</td>
              <td class="num">{pos.market_price.toFixed(3)}</td>
              <td class="num">{money(pos.market_value, pos.currency)}</td>
              <td class="num" class:positive={pos.unrealized_pl >= 0} class:negative={pos.unrealized_pl < 0}>
                {fmt(pos.unrealized_pl)}
              </td>
              <td class="num" class:positive={pos.unrealized_pl_percent >= 0} class:negative={pos.unrealized_pl_percent < 0}>
                {pct(pos.unrealized_pl_percent)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<!-- ── Orders ────────────────────────────────────────────────── -->
<section class="section">
  <div class="section-header">
    <h2 class="section-title">Orders <span class="count">{orders.length}</span></h2>
  </div>

  {#if orders.length === 0}
    <div class="empty">No orders in simulate account.</div>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Side</th>
            <th>Type</th>
            <th class="num">Qty</th>
            <th class="num">Filled</th>
            <th class="num">Price</th>
            <th class="num">Avg Fill</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {#each orders.slice(0, 50) as ord}
            <tr>
              <td class="sym">{ord.symbol.replace(/^HK\.|^US\./, '')}</td>
              <td>
                <span class="side-badge" class:buy={ord.side.toUpperCase() === 'BUY'} class:sell={ord.side.toUpperCase() === 'SELL'}>
                  {ord.side.toUpperCase()}
                </span>
              </td>
              <td class="muted">{ord.order_type}</td>
              <td class="num">{ord.quantity}</td>
              <td class="num">{ord.filled_quantity}</td>
              <td class="num">{ord.price?.toFixed(3) ?? '—'}</td>
              <td class="num">{ord.average_filled_price > 0 ? ord.average_filled_price.toFixed(3) : '—'}</td>
              <td><span class="status-badge {statusClass(ord.status)}">{ord.status}</span></td>
              <td class="muted date">{formatDate(ord.submitted_at)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<!-- ── Deals ──────────────────────────────────────────────────── -->
{#if deals.length > 0}
<section class="section">
  <div class="section-header">
    <h2 class="section-title">Fills <span class="count">{deals.length}</span></h2>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Side</th>
          <th class="num">Qty</th>
          <th class="num">Price</th>
          <th class="num">Fee</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {#each deals.slice(0, 50) as deal}
          <tr>
            <td class="sym">{deal.symbol.replace(/^HK\.|^US\./, '')}</td>
            <td>
              <span class="side-badge" class:buy={deal.side.toUpperCase() === 'BUY'} class:sell={deal.side.toUpperCase() === 'SELL'}>
                {deal.side.toUpperCase()}
              </span>
            </td>
            <td class="num">{deal.quantity}</td>
            <td class="num">{deal.price?.toFixed(3) ?? '—'}</td>
            <td class="num muted">{deal.fee > 0 ? deal.fee.toFixed(2) : '—'}</td>
            <td class="muted date">{formatDate(deal.executed_at)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
{/if}

<style>
  /* ── Connection error card ──────────────────────────────────── */
  .conn-error-card {
    margin-bottom: 20px; padding: 18px 20px;
    border: 1px solid rgba(var(--danger-rgb),.3);
    border-radius: 12px; background: rgba(var(--danger-rgb),.05);
  }
  .conn-error-header {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    color: var(--danger); font-size: 0.8rem; font-weight: 600;
    margin-bottom: 12px;
  }
  .conn-error-msg {
    font-size: 0.7rem; font-weight: 400; font-family: monospace;
    background: rgba(var(--danger-rgb),.1); color: var(--danger);
    padding: 2px 6px; border-radius: 4px; margin-left: 4px;
  }
  .conn-error-intro {
    font-size: 0.76rem; color: var(--text); margin: 0 0 12px; font-weight: 500;
  }
  .conn-steps {
    list-style: none; margin: 0; padding: 0;
    display: flex; flex-direction: column; gap: 12px;
  }
  .conn-steps li {
    display: flex; align-items: flex-start; gap: 10px;
    font-size: 0.76rem; color: var(--text);
  }
  .step-icon {
    display: flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; flex-shrink: 0; border-radius: 6px;
    background: rgba(var(--warning-rgb),.12); color: var(--warning);
    margin-top: 1px;
  }
  .conn-steps li strong { display: block; font-weight: 600; margin-bottom: 2px; }
  .step-detail { display: block; color: var(--muted); margin-top: 2px; }
  .conn-cmd {
    display: block; margin: 6px 0 4px;
    background: var(--surface-1); border: 1px solid var(--border);
    border-radius: 6px; padding: 7px 10px;
    font-size: 0.7rem; font-family: monospace; color: var(--text);
    white-space: pre; overflow-x: auto;
  }
  .saas-unavail { padding: 20px 22px; }
  .support-link {
    display: inline-block; margin-top: 10px;
    font-size: 0.74rem; font-weight: 600; color: var(--primary);
    text-decoration: none;
  }
  .support-link:hover { text-decoration: underline; }

  /* ── Account bar ─────────────────────────────────────────────── */
  .account-bar {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    margin-bottom: 16px;
    padding: 8px 12px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--card);
    font-size: 0.72rem; color: var(--muted);
  }
  .acc-label { font-weight: 700; color: var(--text); }
  .sim-badge {
    font-size: 0.58rem; font-weight: 700; padding: 2px 6px;
    border-radius: 20px; letter-spacing: 0.06em;
    background: rgba(var(--warning-rgb),.12); color: var(--warning);
  }
  .acc-meta { color: var(--muted); }
  .sync-time { margin-left: auto; font-size: 0.65rem; }

  /* ── Stats ───────────────────────────────────────────────────── */
  .stats {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
    margin-bottom: 20px;
  }
  .stat-card {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 16px; border-radius: 10px;
    border: 1px solid var(--border); background: var(--card);
  }
  .stat-icon {
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
    background: rgba(var(--primary-rgb),.1); color: var(--primary);
  }
  .stat-icon.up { background: rgba(var(--success-rgb),.1); color: var(--success); }
  .stat-icon.down { background: rgba(var(--danger-rgb),.1); color: var(--danger); }
  .stat-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .stat-label { font-size: 0.65rem; color: var(--muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat-value { font-size: 0.95rem; font-weight: 700; color: var(--text); }

  /* ── Section ─────────────────────────────────────────────────── */
  .section { margin-bottom: 24px; }
  .section-header { margin-bottom: 8px; }
  .section-title {
    font-size: 0.82rem; font-weight: 700; color: var(--text);
    display: flex; align-items: center; gap: 7px;
  }
  .count {
    font-size: 0.65rem; font-weight: 700; padding: 1px 6px;
    border-radius: 20px; background: rgba(var(--primary-rgb),.1); color: var(--primary);
  }

  /* ── Table ───────────────────────────────────────────────────── */
  .table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--border); }
  table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
  thead { background: var(--surface-1); }
  th {
    padding: 8px 12px; text-align: left;
    font-size: 0.62rem; font-weight: 700; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.05em;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  td { padding: 9px 12px; border-bottom: 1px solid var(--border); color: var(--text); white-space: nowrap; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(var(--primary-rgb),.03); }
  .num { text-align: right; }
  .sym { font-weight: 700; font-family: monospace; font-size: 0.8rem; }
  .name { color: var(--muted); max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
  .muted { color: var(--muted); }
  .date { font-size: 0.68rem; }

  /* ── Colors ──────────────────────────────────────────────────── */
  .positive { color: var(--success); }
  .negative { color: var(--danger); }

  /* ── Badges ──────────────────────────────────────────────────── */
  .side-badge {
    display: inline-block; padding: 2px 7px; border-radius: 4px;
    font-size: 0.62rem; font-weight: 700; letter-spacing: 0.04em;
  }
  .side-badge.buy  { background: rgba(var(--success-rgb),.12); color: var(--success); }
  .side-badge.sell { background: rgba(var(--danger-rgb),.12);  color: var(--danger);  }

  .status-badge {
    display: inline-block; padding: 2px 7px; border-radius: 4px;
    font-size: 0.62rem; font-weight: 700;
  }
  .status-badge.filled    { background: rgba(var(--success-rgb),.12); color: var(--success); }
  .status-badge.cancelled { background: rgba(var(--muted-rgb, 128,128,128),.12); color: var(--muted); }
  .status-badge.pending   { background: rgba(var(--warning-rgb),.12); color: var(--warning); }
  .status-badge.other     { background: rgba(var(--primary-rgb),.1); color: var(--primary); }

  /* ── Empty ───────────────────────────────────────────────────── */
  .empty {
    padding: 24px; text-align: center; font-size: 0.76rem;
    color: var(--muted); border: 1px dashed var(--border); border-radius: 10px;
  }

  /* ── Responsive ──────────────────────────────────────────────── */
  @media (max-width: 900px) { .stats { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 500px) { .stats { grid-template-columns: 1fr; } }

  .agent-badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 0.68rem; color: var(--muted);
    margin-bottom: 12px;
  }
</style>
