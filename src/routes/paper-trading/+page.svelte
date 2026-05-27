<script lang="ts">
  import { onMount } from 'svelte';
  import { FlaskConical, RefreshCw, TrendingUp, TrendingDown, DollarSign, BarChart2, AlertTriangle, Terminal, MonitorCheck, Wifi, RotateCcw, ServerCrash, Radio } from 'lucide-svelte';
  import { PUBLIC_APP_MODE } from '$env/static/public';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import type { ActionData, PageData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import { portfolioSummary } from '$lib/stores/portfolio-summary';

  const isSaas = PUBLIC_APP_MODE === 'saas';

  export let data: PageData;
  export let form: ActionData;


  // Order form state (just the toggles for now — form fields come in Tasks 5-6)
  let showOrderForm = false;
  let showResetModal = false;

  // Toast state
  let toasts: { id: number; type: 'success' | 'warn' | 'error'; message: string }[] = [];
  let toastCounter = 0;

  function addToast(type: 'success' | 'warn' | 'error', message: string) {
    const id = ++toastCounter;
    toasts = [...toasts, { id, type, message }];
    setTimeout(() => { toasts = toasts.filter(t => t.id !== id); }, 4000);
  }

  // Account balance panel helpers
  function usedCollateral(ai: typeof info): number {
    return (ai.total_assets ?? 0) - (ai.cash ?? 0) - (ai.market_val ?? 0);
  }

  // ── Order form state ──────────────────────────────────────────
  let activeTab: 'stock' | 'option' = 'stock';

  // Stock form
  let stockSide: 'BUY' | 'SELL' = 'BUY';
  let stockSymbol = '';
  let stockOrderType: 'market' | 'limit' = 'limit';
  let stockQty: number | null = null;
  let stockPrice: number | null = null;

  // Option form
  let optSymbol = '';
  let optExpiry = '';
  let optType: 'call' | 'put' = 'call';
  let optExpiryList: string[] = [];
  let optChain: { strike: number; bid: number; ask: number; iv: number; option_code: string; spread_pct: number }[] = [];
  let optSelectedCode = '';
  let optSelectedBid = 0;
  let optSelectedAsk = 0;
  let optSelectedStrike = 0;
  let optSide: 'BUY' | 'SELL' = 'BUY';
  let optQty = 1;
  let optPrice: number | null = null;
  let chainRequestId = 0;
  let optExpiryLoading = false;
  let optChainLoading = false;
  let optExpiryError = '';
  let optChainError = '';

  async function fetchExpiry() {
    if (optSymbol.trim().length < 2) return;
    optExpiryLoading = true;
    optExpiryError = '';
    optExpiryList = [];
    optExpiry = '';
    optChain = [];
    optSelectedCode = '';
    try {
      const r = await fetch(`/api/paper/options/expiry?symbol=${encodeURIComponent(optSymbol.trim())}`);
      if (!r.ok) throw new Error(r.statusText);
      const data = await r.json();
      if (data.error) { optExpiryError = 'Bridge offline'; return; }
      optExpiryList = data.expiry_dates ?? data ?? [];
    } catch {
      optExpiryError = 'Bridge offline';
    } finally {
      optExpiryLoading = false;
    }
  }

  async function fetchChain() {
    if (!optExpiry || !optSymbol.trim()) { optChain = []; return; }
    const reqId = ++chainRequestId;
    optChainLoading = true;
    optChainError = '';
    try {
      const qs = new URLSearchParams({ symbol: optSymbol, expiry: optExpiry, option_type: optType });
      const r = await fetch(`/api/paper/options/chain?${qs}`);
      if (reqId !== chainRequestId) return; // discard stale response
      if (!r.ok) throw new Error(r.statusText);
      const data = await r.json();
      if (reqId !== chainRequestId) return; // check again after json parse
      if (data.error) throw new Error(data.error);
      type RawChainRow = { strike: number; bid: number; ask: number; iv: number; option_code: string };
      const rows: RawChainRow[] = data.chain ?? data ?? [];
      optChain = rows.map((row) => ({
        ...row,
        spread_pct: row.ask > 0 ? (row.ask - row.bid) / row.ask * 100 : 0
      }));
      optSelectedCode = '';
    } catch (e) {
      if (reqId !== chainRequestId) return;
      optChainError = e instanceof Error ? e.message : 'Bridge offline';
      optChain = [];
    } finally {
      if (reqId === chainRequestId) optChainLoading = false;
    }
  }

  function selectStrike(row: { strike: number; bid: number; ask: number; iv: number; option_code: string; spread_pct: number }) {
    optSelectedCode = row.option_code;
    optSelectedBid = row.bid;
    optSelectedAsk = row.ask;
    optSelectedStrike = row.strike;
    optPrice = optSide === 'BUY' ? row.ask : row.bid;
  }

  function daysToExpiry(expiry: string): number {
    const now = new Date();
    const exp = new Date(expiry);
    return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Re-fetch chain when expiry or type changes
  $: optExpiry, optType, fetchChain();

  // Validation / preview state (wired fully in Tasks 7-8)
  let validationErrors: string[] = [];
  let previewData: {
    symbol: string; side: string; qty: number;
    estimated_value: number;
    safety_status: 'pass' | 'warn' | 'block';
    message: string; risk_notes: string[]; warnings: string[];
    asset_type?: string; order_type?: string; price?: number; option_code?: string;
  } | null = null;
  let previewLoading = false;

  function validateOrder(): string[] {
    const errors: string[] = [];
    if (activeTab === 'stock') {
      if (!stockSymbol.trim()) errors.push('Symbol is required');
      if (!stockQty || stockQty <= 0) errors.push('Quantity is required and must be at least 1');
      if (stockOrderType === 'limit' && (!stockPrice || stockPrice <= 0)) errors.push('Limit price is required for limit orders');
    } else {
      if (!optSymbol.trim()) errors.push('Symbol is required');
      if (!optSelectedCode) errors.push('Select a strike from the chain table');
      if (!optQty || optQty <= 0) errors.push('Quantity is required and must be at least 1');
      if (!optPrice || optPrice <= 0) errors.push('Limit price is required');
    }
    return errors;
  }

  function handlePreviewEnhance() {
    validationErrors = validateOrder();
    if (validationErrors.length > 0) {
      return () => {};
    }
    previewLoading = true;
    localStorage.setItem('paper_last_symbol', activeTab === 'stock' ? stockSymbol : optSymbol);
    return async ({ result, update }: { result: any; update: () => Promise<void> }) => {
      previewLoading = false;
      if (result.type === 'success' && result.data) {
        previewData = result.data as typeof previewData;
      } else if (result.type === 'failure') {
        const msg = (result.data as any)?.message ?? 'Preview failed';
        const isOffline = (result.data as any)?.bridgeOffline;
        addToast(isOffline ? 'warn' : 'error', isOffline ? `⚠ Bridge offline — ${msg}` : msg);
      }
      await update();
    };
  }

  onMount(() => {
    const last = localStorage.getItem('paper_last_symbol');
    if (last) { stockSymbol = last; optSymbol = last; }
  });

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

<!-- ── Toasts ─────────────────────────────────────────────────── -->
<div class="toast-container">
  {#each toasts as t (t.id)}
    <div class="toast toast-{t.type}">
      {t.message}
    </div>
  {/each}
</div>

<PageHeader
  title="Paper Trading"
  subtitle="Moomoo simulate account — live positions, orders and trade history."
  breadcrumb={[{ label: 'Paper Trading' }]}
/>

<!-- ── Header actions ─────────────────────────────────────────── -->
{#if !paper.error}
  <div class="header-actions">
    <button class="btn-new-order" on:click={() => showOrderForm = !showOrderForm}>
      {showOrderForm ? '✕ Close' : '+ New Order'}
    </button>
    <button class="btn-reset" on:click={() => showResetModal = true}>
      Reset Account
    </button>
  </div>
{/if}

<!-- ── Account balance panel (amber) ─────────────────────────── -->
{#if !paper.error}
  <div class="balance-panel">
    <div class="balance-stat">
      <div class="balance-label">Cash Available</div>
      <div class="balance-value">{money(info.cash ?? 0)}</div>
    </div>
    <div class="balance-stat">
      <div class="balance-label">Buying Power</div>
      <div class="balance-value">{money(info.power ?? 0)}</div>
    </div>
    <div class="balance-stat">
      <div class="balance-label">Used Collateral</div>
      <div class="balance-value">{money(usedCollateral(info))}</div>
    </div>
    <div class="balance-stat">
      <div class="balance-label">Unrealized P&amp;L</div>
      <div class="balance-value" class:positive={info.unrealized_pl >= 0} class:negative={info.unrealized_pl < 0}>
        {fmt(info.unrealized_pl ?? 0)}
      </div>
    </div>
  </div>
{/if}

<!-- ── Inline order form ──────────────────────────────────────── -->
{#if showOrderForm && !paper.error}
  <div class="order-form-wrap">
    <div class="order-form-tabs">
      <button class="tab-btn" class:active={activeTab === 'stock'} on:click={() => activeTab = 'stock'}>Stock</button>
      <button class="tab-btn" class:active={activeTab === 'option'} on:click={() => activeTab = 'option'}>Option</button>
    </div>

    {#if activeTab === 'stock'}
      <form method="POST" action="?/previewOrder" use:enhance={handlePreviewEnhance}>
        <input type="hidden" name="asset_type" value="stock" />

        <!-- Side toggle -->
        <div class="form-field">
          <label class="field-label">Side</label>
          <div class="toggle-row">
            <button type="button" class="toggle-btn" class:buy={stockSide === 'BUY'} on:click={() => stockSide = 'BUY'}>BUY</button>
            <button type="button" class="toggle-btn" class:sell={stockSide === 'SELL'} on:click={() => stockSide = 'SELL'}>SELL</button>
          </div>
          <input type="hidden" name="side" value={stockSide} />
        </div>

        <!-- Symbol -->
        <div class="form-field">
          <label class="field-label" for="stock-symbol">Symbol</label>
          <input id="stock-symbol" name="symbol" type="text"
            bind:value={stockSymbol}
            on:input={() => stockSymbol = stockSymbol.toUpperCase()}
            placeholder="AAPL"
            class="form-input" />
        </div>

        <!-- Order type toggle -->
        <div class="form-field">
          <label class="field-label">Order Type</label>
          <div class="toggle-row">
            <button type="button" class="toggle-btn" class:active-type={stockOrderType === 'limit'} on:click={() => stockOrderType = 'limit'}>Limit</button>
            <button type="button" class="toggle-btn" class:active-type={stockOrderType === 'market'} on:click={() => stockOrderType = 'market'}>Market</button>
          </div>
          <input type="hidden" name="order_type" value={stockOrderType} />
        </div>

        <!-- Qty -->
        <div class="form-field">
          <label class="field-label" for="stock-qty">Qty (shares)</label>
          <input id="stock-qty" name="qty" type="number" min="1" step="1"
            bind:value={stockQty} placeholder="1" class="form-input" />
        </div>

        <!-- Limit price (hidden when Market) -->
        {#if stockOrderType === 'limit'}
          <div class="form-field">
            <label class="field-label" for="stock-price">Limit Price</label>
            <input id="stock-price" name="price" type="number" min="0.01" step="0.01"
              bind:value={stockPrice} placeholder="182.50" class="form-input" />
          </div>
        {/if}

        <!-- Validation errors -->
        {#if validationErrors.length > 0}
          <div class="validation-errors">
            {#each validationErrors as err}<div>• {err}</div>{/each}
          </div>
        {/if}

        <div class="form-actions">
          <button type="submit" class="btn-preview" disabled={previewLoading}>
            {previewLoading ? 'Loading…' : 'Preview Order →'}
          </button>
        </div>

        <!-- Paper notice strip -->
        <div class="paper-notice">⚗ Paper mode — no real money will be used</div>
      </form>
    {:else}
      <!-- OPTION TAB -->
      <form method="POST" action="?/previewOrder" use:enhance={handlePreviewEnhance}>
        <input type="hidden" name="asset_type" value="option" />
        <input type="hidden" name="option_code" value={optSelectedCode} />
        <input type="hidden" name="side" value={optSide} />
        <input type="hidden" name="symbol" value={optSymbol} />

        <!-- Step 1: Symbol + expiry + type -->
        <div class="form-field">
          <label class="field-label" for="opt-symbol">Underlying Symbol</label>
          <input id="opt-symbol" type="text"
            bind:value={optSymbol}
            on:input={() => optSymbol = optSymbol.toUpperCase()}
            on:blur={fetchExpiry}
            placeholder="AAPL"
            class="form-input" />
        </div>

        <div class="opt-row">
          <div class="form-field" style="flex:1">
            <label class="field-label" for="opt-expiry">Expiry</label>
            {#if optExpiryLoading}
              <div class="form-input muted-val">Loading…</div>
            {:else if optExpiryError}
              <div class="form-input muted-val danger-text">{optExpiryError}</div>
            {:else}
              <select id="opt-expiry" class="form-input" bind:value={optExpiry}>
                <option value="">Select expiry</option>
                {#each optExpiryList as d}<option value={d}>{d}</option>{/each}
              </select>
            {/if}
          </div>
          <div class="form-field" style="flex:0 0 auto">
            <label class="field-label">Type</label>
            <div class="toggle-row">
              <button type="button" class="toggle-btn" class:active-type={optType === 'call'} on:click={() => { optType = 'call'; }}>CALL</button>
              <button type="button" class="toggle-btn" class:active-type={optType === 'put'}  on:click={() => { optType = 'put'; }}>PUT</button>
            </div>
          </div>
        </div>

        <!-- Step 2: Option chain table -->
        {#if optExpiry && !optChainLoading && !optChainError && optChain.length > 0}
          <div class="chain-wrap">
            <table class="chain-table">
              <thead>
                <tr>
                  <th>Strike</th>
                  <th class="num">Bid</th>
                  <th class="num">Ask</th>
                  <th class="num">IV%</th>
                  <th class="num">Spread</th>
                </tr>
              </thead>
              <tbody>
                {#each optChain as row}
                  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
                  <tr
                    class:chain-selected={optSelectedCode === row.option_code}
                    on:click={() => selectStrike(row)}
                  >
                    <td class="sym">
                      ${row.strike}
                      {#if row.spread_pct > 30}<span class="spread-warn" title="Wide spread">⚠</span>{/if}
                    </td>
                    <td class="num">{row.bid.toFixed(2)}</td>
                    <td class="num">{row.ask.toFixed(2)}</td>
                    <td class="num">{row.iv.toFixed(1)}%</td>
                    <td class="num">{row.spread_pct.toFixed(1)}%</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else if optChainLoading}
          <div class="chain-status muted">Loading chain…</div>
        {:else if optChainError}
          <div class="chain-status danger-text">{optChainError}</div>
        {/if}

        <!-- Step 3: After strike selected -->
        {#if optSelectedCode}
          <div class="selected-contract">
            <span class="muted">Selected: </span>
            <strong style="color:var(--primary)">{optSymbol} {optExpiry} ${optSelectedStrike} {optType.toUpperCase()}</strong>
            · Ask ${optSelectedAsk.toFixed(2)}
          </div>

          {#if optExpiry && daysToExpiry(optExpiry) <= 7}
            <div class="warn-strip">⚠ Expiry in {daysToExpiry(optExpiry)} days — theta decay is accelerating</div>
          {/if}

          {#if optSelectedAsk > 0 && (optSelectedAsk - optSelectedBid) / optSelectedAsk > 0.30}
            <div class="warn-strip">⚠ Wide spread (&gt;30%) — you may get a worse fill</div>
          {/if}

          <div class="form-field">
            <label class="field-label">Side</label>
            <div class="toggle-row">
              <button type="button" class="toggle-btn" class:buy={optSide === 'BUY'} on:click={() => { optSide = 'BUY'; optPrice = optSelectedAsk; }}>BUY</button>
              <button type="button" class="toggle-btn" class:sell={optSide === 'SELL'} on:click={() => { optSide = 'SELL'; optPrice = optSelectedBid; }}>SELL</button>
            </div>
          </div>

          <div class="opt-row">
            <div class="form-field" style="flex:1">
              <label class="field-label" for="opt-qty">Contracts</label>
              <input id="opt-qty" name="qty" type="number" min="1" step="1"
                bind:value={optQty} class="form-input" />
            </div>
            <div class="form-field" style="flex:1">
              <label class="field-label" for="opt-price">Limit Price</label>
              <input id="opt-price" name="price" type="number" min="0.01" step="0.01"
                bind:value={optPrice} class="form-input" />
            </div>
          </div>
        {/if}

        <!-- Validation errors -->
        {#if validationErrors.length > 0}
          <div class="validation-errors">
            {#each validationErrors as err}<div>• {err}</div>{/each}
          </div>
        {/if}

        <div class="form-actions">
          <button type="submit" class="btn-preview" disabled={!optSelectedCode || previewLoading}>
            {previewLoading ? 'Loading…' : 'Preview Order →'}
          </button>
        </div>
        <div class="paper-notice">⚗ Paper mode — no real money will be used</div>
      </form>
    {/if}
  </div>
{/if}

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

  /* ── Account balance panel ───────────────────────────────────── */
  .balance-panel {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
    margin-bottom: 16px; padding: 14px 16px;
    border: 1px solid rgba(245,158,11,0.25);
    border-radius: 10px; background: rgba(245,158,11,0.05);
  }
  .balance-stat { display: flex; flex-direction: column; gap: 3px; }
  .balance-label {
    font-size: 0.62rem; font-weight: 600; color: rgba(245,158,11,0.7);
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .balance-value { font-size: 0.9rem; font-weight: 700; color: var(--text); }

  /* ── Header actions ──────────────────────────────────────────── */
  .header-actions {
    display: flex; gap: 8px; align-items: center;
    margin-bottom: 16px;
  }
  .btn-new-order {
    padding: 7px 16px; border-radius: 7px;
    background: var(--primary); border: none; color: #fff;
    font-size: 0.75rem; font-weight: 700; cursor: pointer;
    transition: opacity 0.15s;
  }
  .btn-new-order:hover { opacity: 0.85; }
  .btn-reset {
    padding: 7px 14px; border-radius: 7px;
    background: rgba(var(--danger-rgb),0.1); border: 1px solid rgba(var(--danger-rgb),0.25);
    color: var(--danger); font-size: 0.75rem; font-weight: 600; cursor: pointer;
  }
  .btn-reset:hover { background: rgba(var(--danger-rgb),0.18); }

  /* ── Toasts ──────────────────────────────────────────────────── */
  .toast-container {
    position: fixed; bottom: 24px; right: 24px; z-index: 999;
    display: flex; flex-direction: column; gap: 8px; align-items: flex-end;
  }
  .toast {
    padding: 10px 16px; border-radius: 8px;
    font-size: 0.76rem; font-weight: 600;
    max-width: 360px; box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    animation: toast-in 0.2s ease;
  }
  @keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .toast-success { background: rgba(var(--success-rgb),0.15); border: 1px solid rgba(var(--success-rgb),0.4); color: var(--success); }
  .toast-warn    { background: rgba(245,158,11,0.12);         border: 1px solid rgba(245,158,11,0.35);       color: var(--warning); }
  .toast-error   { background: rgba(var(--danger-rgb),0.12);  border: 1px solid rgba(var(--danger-rgb),0.35); color: var(--danger); }

  @media (max-width: 900px) { .balance-panel { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 500px) { .balance-panel { grid-template-columns: 1fr; } }

  /* ── Order form ──────────────────────────────────────────────── */
  .order-form-wrap {
    margin-bottom: 20px; padding: 18px;
    border: 1px solid var(--border); border-radius: 12px;
    background: var(--card);
  }
  .order-form-tabs { display: flex; gap: 6px; margin-bottom: 16px; }
  .tab-btn {
    padding: 5px 16px; border-radius: 6px;
    background: var(--surface-1); border: 1px solid var(--border);
    font-size: 0.72rem; font-weight: 600; color: var(--muted); cursor: pointer;
  }
  .tab-btn.active {
    background: rgba(var(--primary-rgb),0.12); border-color: rgba(var(--primary-rgb),0.4);
    color: var(--primary);
  }
  .form-field { margin-bottom: 12px; }
  .field-label { display: block; font-size: 0.62rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; }
  .form-input {
    width: 100%; padding: 7px 10px; border-radius: 7px;
    background: var(--surface-1); border: 1px solid var(--border);
    color: var(--text); font-size: 0.8rem; box-sizing: border-box;
  }
  .form-input:focus { outline: none; border-color: rgba(var(--primary-rgb),0.5); }
  .toggle-row { display: flex; gap: 4px; }
  .toggle-btn {
    flex: 1; padding: 5px 10px; border-radius: 6px;
    background: var(--surface-1); border: 1px solid var(--border);
    font-size: 0.7rem; font-weight: 700; color: var(--muted); cursor: pointer;
  }
  .toggle-btn.buy  { background: rgba(var(--success-rgb),0.15); border-color: rgba(var(--success-rgb),0.4); color: var(--success); }
  .toggle-btn.sell { background: rgba(var(--danger-rgb),0.15);  border-color: rgba(var(--danger-rgb),0.4);  color: var(--danger); }
  .toggle-btn.active-type { background: rgba(var(--primary-rgb),0.12); border-color: rgba(var(--primary-rgb),0.4); color: var(--primary); }
  .form-actions { margin-top: 14px; }
  .btn-preview {
    width: 100%; padding: 9px; border-radius: 8px;
    background: var(--primary); border: none; color: #fff;
    font-size: 0.8rem; font-weight: 700; cursor: pointer;
  }
  .btn-preview:disabled { opacity: 0.6; cursor: not-allowed; }
  .paper-notice {
    margin-top: 10px; padding: 6px 10px; border-radius: 6px;
    background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.2);
    font-size: 0.7rem; color: var(--warning);
  }
  .validation-errors {
    margin-bottom: 10px; padding: 8px 12px; border-radius: 7px;
    background: rgba(var(--danger-rgb),0.08); border: 1px solid rgba(var(--danger-rgb),0.25);
    color: var(--danger); font-size: 0.72rem; line-height: 1.6;
  }

  /* ── Option chain table ──────────────────────────────────────── */
  .opt-row { display: flex; gap: 10px; align-items: flex-end; }
  .chain-wrap {
    border: 1px solid var(--border); border-radius: 8px; overflow-y: auto;
    max-height: 280px; margin-bottom: 12px;
  }
  .chain-table { width: 100%; border-collapse: collapse; font-size: 0.74rem; }
  .chain-table thead { background: var(--surface-1); }
  .chain-table th {
    padding: 6px 10px; text-align: left;
    font-size: 0.6rem; font-weight: 700; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.04em;
    border-bottom: 1px solid var(--border);
  }
  .chain-table td { padding: 7px 10px; border-bottom: 1px solid var(--border); cursor: pointer; }
  .chain-table tr:last-child td { border-bottom: none; }
  .chain-table tr:hover td { background: rgba(var(--primary-rgb),0.05); }
  .chain-selected td { background: rgba(var(--primary-rgb),0.12) !important; color: var(--primary); font-weight: 700; }
  .spread-warn { color: var(--warning); margin-left: 4px; font-size: 0.65rem; }
  .chain-status { padding: 12px; font-size: 0.74rem; text-align: center; }
  .muted-val { color: var(--muted); }
  .danger-text { color: var(--danger); }
  .selected-contract {
    padding: 8px 10px; border-radius: 6px;
    background: var(--surface-1); border: 1px solid var(--border);
    font-size: 0.74rem; margin-bottom: 12px;
  }
  .warn-strip {
    padding: 6px 10px; border-radius: 6px; margin-bottom: 10px;
    background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25);
    font-size: 0.72rem; color: var(--warning);
  }
</style>
