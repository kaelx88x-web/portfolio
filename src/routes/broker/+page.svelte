<script lang="ts">
  import { enhance } from '$app/forms';
  import { onMount, onDestroy } from 'svelte';
  import type { ActionData, PageData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import { RefreshCw, MonitorCheck, Terminal, Wifi, RotateCcw, ServerCrash, Radio } from 'lucide-svelte';
  import { PUBLIC_APP_MODE } from '$env/static/public';

  const isSaas = PUBLIC_APP_MODE === 'saas';

  // Auto-poll interval when disconnected (ms)
  const POLL_INTERVAL = 15_000;
  const RECONNECT_FLASH_MS = 2000;

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let reconnecting = false;
  let justReconnected = false;

  // Live status — starts from SSR data, updated by polling
  $: liveStatus = status;

  async function pollStatus() {
    try {
      const res = await fetch('/api/broker/status');
      if (!res.ok) return;
      const data = await res.json();
      const wasDown = !liveStatus?.connected;
      liveStatus = data.status;
      if (wasDown && liveStatus?.connected) {
        justReconnected = true;
        setTimeout(() => { justReconnected = false; }, RECONNECT_FLASH_MS);
      }
    } catch {
      liveStatus = null;
    } finally {
      reconnecting = false;
    }
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(pollStatus, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  async function retryNow() {
    reconnecting = true;
    await pollStatus();
    // If still down, keep polling
    if (!liveStatus?.connected) startPolling();
    else stopPolling();
  }

  onMount(() => {
    // Start polling immediately if down on load
    if (!liveStatus?.connected) startPolling();
  });

  onDestroy(stopPolling);

  // React to live status changes
  $: if (liveStatus?.connected) stopPolling();
  $: if (!liveStatus?.connected && typeof window !== 'undefined') startPolling();

  export let data: PageData;
  export let form: ActionData = null;

  $: status = data.status;
  $: syncLogs = data.syncLogs ?? [];
  $: holdings = form?.holdings ?? [];
  $: accountInfo = form?.account_info ?? null;
  $: agentStatus = data.agentStatus;

  let syncing = false;
  $: liveStatus = status;  // will be overwritten reactively by polling

  function fmt(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }

  function relativeTime(date: string) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
</script>

<PageHeader title="Broker Sync" subtitle="Moomoo OpenD — sync live positions into your portfolio." />

<!-- Reconnected flash -->
{#if justReconnected}
  <div class="reconnect-flash">
    <Radio size={13} />
    Broker reconnected — ready to sync.
  </div>
{/if}

<!-- Auto-polling indicator -->
{#if !liveStatus?.connected && pollTimer && !reconnecting}
  <div class="polling-bar">
    <span class="poll-dot"></span>
    Checking connection every {POLL_INTERVAL / 1000}s…
    <button class="retry-btn" on:click={retryNow}>Check now</button>
  </div>
{/if}
{#if reconnecting}
  <div class="polling-bar">
    <span class="poll-dot spin-dot"></span>
    Checking connection…
  </div>
{/if}

<!-- Action bar -->
<div class="action-bar">
  <form
    method="POST"
    action="?/sync"
    use:enhance={() => {
      syncing = true;
      return async ({ update }) => {
        try { await update(); } finally { syncing = false; }
      };
    }}
  >
    <button class="button-primary" disabled={!liveStatus?.connected || syncing}>
      <RefreshCw size={14} class={syncing ? 'spin' : ''} />
      {syncing ? 'Syncing…' : 'Sync Moomoo'}
    </button>
  </form>
</div>

<!-- Feedback message -->
{#if form?.message}
  <div class="msg-banner" class:success={form.success} class:error={!form.success}>
    {form.message}
    {#if form.synced_at}
      <span class="msg-time">at {new Date(form.synced_at).toLocaleTimeString()}</span>
    {/if}
  </div>
{/if}

<!-- Status cards -->
<div class="status-grid">
  <div class="card stat-card">
    <div class="stat-label">OpenD</div>
    <div class="stat-row-inner">
      <span class="dot" class:dot-ok={liveStatus?.connected} class:dot-err={!liveStatus?.connected}></span>
      <span class="stat-val">{liveStatus?.connected ? 'Connected' : (liveStatus ? 'Disconnected' : 'Unreachable')}</span>
    </div>
    <p class="stat-sub">{liveStatus?.message ?? 'Start OpenD to connect'}</p>
  </div>

  <div class="card stat-card">
    <div class="stat-label">Quote Feed</div>
    <div class="stat-row-inner">
      <span class="dot" class:dot-ok={liveStatus?.quote_logged_in} class:dot-warn={!liveStatus?.quote_logged_in}></span>
      <span class="stat-val">{liveStatus?.quote_logged_in ? 'Logged in' : '—'}</span>
    </div>
  </div>

  <div class="card stat-card">
    <div class="stat-label">Trade API</div>
    <div class="stat-row-inner">
      <span class="dot" class:dot-ok={liveStatus?.trade_logged_in} class:dot-warn={!liveStatus?.trade_logged_in}></span>
      <span class="stat-val">{liveStatus?.trade_logged_in ? 'Logged in' : '—'}</span>
    </div>
  </div>

  <div class="card stat-card">
    <div class="stat-label">Total Assets</div>
    <span class="stat-val">{accountInfo?.total_assets ? fmt(accountInfo.total_assets) : '—'}</span>
    {#if accountInfo?.cash}
      <p class="stat-sub">Cash: {fmt(accountInfo.cash)}</p>
    {/if}
  </div>

  {#if agentStatus}
    <div class="card stat-card">
      <div class="stat-label">Local Agent</div>
      <div class="stat-row-inner">
        <span class="dot" class:dot-ok={agentStatus.status === 'active'} class:dot-warn={agentStatus.status !== 'active'}></span>
        <span class="stat-val">{agentStatus.status === 'active' ? 'Active' : 'Pending'}</span>
      </div>
      <p class="stat-sub">
        {#if agentStatus.lastPushAt}
          Last push {relativeTime(agentStatus.lastPushAt.toString())}
        {:else}
          <a href="/settings/agent" class="agent-setup-link">Set up agent →</a>
        {/if}
      </p>
    </div>
  {/if}
</div>

<!-- Connection guide — shown when moomoo-service is unreachable -->
{#if !liveStatus}
  {#if isSaas}
    <div class="conn-warn saas-unavail">
      <ServerCrash size={15} />
      <div>
        <strong>Broker connection unavailable</strong>
        <span>The broker sync service is temporarily unreachable. Please try again in a few minutes. If the issue persists, contact support.</span>
        <a href="mailto:support@portfolioai.app" class="support-link">Contact support →</a>
      </div>
    </div>
  {:else}
    <div class="conn-guide">
      <div class="conn-guide-header">
        <Wifi size={15} />
        <span>Moomoo bridge unreachable — follow these steps to connect</span>
      </div>
      <ol class="guide-steps">
        <li>
          <span class="gs-icon"><MonitorCheck size={13} /></span>
          <div>
            <strong>Open Moomoo OpenD</strong>
            <span class="gs-detail">Launch the <em>OpenD</em> desktop app and wait until it shows <em>"Connected"</em>. Log in if prompted.</span>
          </div>
        </li>
        <li>
          <span class="gs-icon"><Terminal size={13} /></span>
          <div>
            <strong>Start the moomoo-service bridge</strong>
            <span class="gs-detail">In a terminal at the project root:</span>
            <pre class="gs-cmd">cd moomoo-service
python main.py</pre>
            <span class="gs-detail">You should see <em>"Uvicorn running on http://127.0.0.1:8001"</em>.</span>
          </div>
        </li>
        <li>
          <span class="gs-icon"><Wifi size={13} /></span>
          <div>
            <strong>Check port 8001 is free</strong>
            <span class="gs-detail">If another app is on port 8001, stop it first:</span>
            <pre class="gs-cmd">netstat -ano | findstr :8001
taskkill /PID &lt;pid&gt; /F</pre>
          </div>
        </li>
        <li>
          <span class="gs-icon"><RotateCcw size={13} /></span>
          <div>
            <strong>Reload this page</strong>
            <span class="gs-detail">Once both OpenD and moomoo-service are running, refresh to check status.</span>
          </div>
        </li>
      </ol>
    </div>
  {/if}
{:else if !liveStatus.connected}
  <div class="conn-warn">
    <MonitorCheck size={14} />
    <div>
      <strong>OpenD is not connected.</strong>
      <span>{liveStatus.message ?? 'Open the Moomoo OpenD desktop app and wait for it to connect before syncing.'}</span>
    </div>
  </div>
{/if}

<!-- Synced holdings preview (only after a sync action) -->
{#if holdings.length > 0}
  <div class="card section-card">
    <div class="section-header">
      <span class="section-title">Synced Positions</span>
      <span class="badge-count">{holdings.length}</span>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Name</th>
            <th class="th-r">Qty</th>
            <th class="th-r">Avg Cost</th>
            <th class="th-r">Mkt Value</th>
            <th class="th-r">Unr. P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {#each holdings as h}
            <tr>
              <td class="td-symbol">{h.symbol}</td>
              <td class="td-muted">{h.name ?? '—'}</td>
              <td class="td-r">{h.quantity}</td>
              <td class="td-r">{fmt(h.average_cost)}</td>
              <td class="td-r">{fmt(h.market_value)}</td>
              <td class="td-r" class:positive={h.unrealized_pl >= 0} class:negative={h.unrealized_pl < 0}>
                {fmt(h.unrealized_pl)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}

<!-- Sync activity log from DB -->
<div class="card section-card">
  <div class="section-header">
    <span class="section-title">Sync History</span>
  </div>
  {#if syncLogs.length === 0}
    <p class="empty-text">No sync activity yet. Press "Sync Moomoo" to start.</p>
  {:else}
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Broker</th>
            <th>Event</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {#each syncLogs as log}
            <tr>
              <td class="td-muted td-sm">{relativeTime(log.createdAt.toString())}</td>
              <td>{log.broker}</td>
              <td class="td-muted">
                {#if log.status === 'success'}
                  Imported {log.recordCount} position{log.recordCount !== 1 ? 's' : ''}
                {:else}
                  {log.errorMessage ?? 'Sync failed'}
                {/if}
              </td>
              <td>
                <span class="badge" class:badge-ok={log.status === 'success'} class:badge-err={log.status !== 'success'}>
                  {log.status}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .action-bar   { display: flex; justify-content: flex-end; margin-bottom: 16px; }

  .button-primary {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 8px;
    background: var(--primary); border: none;
    font-size: 0.8rem; font-weight: 600; color: #fff;
    cursor: pointer; transition: opacity 0.15s;
  }
  .button-primary:disabled { opacity: 0.45; cursor: not-allowed; }
  .button-primary:not(:disabled):hover { opacity: 0.85; }

  :global(.spin) { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  .msg-banner {
    margin-bottom: 16px; padding: 10px 14px;
    border-radius: 8px; font-size: 0.8rem; font-weight: 500;
    border: 1px solid;
  }
  .msg-banner.success { background: rgba(45,212,160,0.08); border-color: rgba(45,212,160,0.3); color: #2dd4a0; }
  .msg-banner.error   { background: rgba(249,107,126,0.08); border-color: rgba(249,107,126,0.3); color: #f96b7e; }
  .msg-time { font-size: 0.7rem; opacity: 0.7; margin-left: 8px; }

  .status-grid  { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; margin-bottom: 16px; }
  @media (min-width: 900px) { .status-grid { grid-template-columns: repeat(4,1fr); } }

  .stat-card { padding: 14px 16px; }
  .stat-label { font-size: 0.65rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
  .stat-row-inner { display: flex; align-items: center; gap: 6px; }
  .stat-val { font-size: 0.95rem; font-weight: 700; color: var(--text); }
  .stat-sub { font-size: 0.7rem; color: var(--muted); margin-top: 4px; }

  .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .dot-ok   { background: var(--success); }
  .dot-warn { background: var(--muted); }
  .dot-err  { background: var(--danger); }

  .section-card   { padding: 16px; margin-bottom: 16px; }
  .section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
  .section-title  { font-size: 0.85rem; font-weight: 600; color: var(--text); }
  .badge-count    { font-size: 0.65rem; font-weight: 700; padding: 2px 7px; border-radius: 20px; background: rgba(var(--primary-rgb),0.12); color: var(--primary); }

  .empty-text  { font-size: 0.78rem; color: var(--muted); }

  .th-r      { text-align: right; }
  .td-r      { text-align: right; }
  .td-symbol { font-weight: 700; color: var(--primary); }
  .td-muted  { color: var(--muted); }
  .td-sm     { font-size: 0.72rem; }
  .positive  { color: var(--success); }
  .negative  { color: var(--danger); }

  .badge { font-size: 0.65rem; font-weight: 700; padding: 2px 7px; border-radius: 20px; }
  .badge-ok  { background: rgba(var(--success-rgb),0.12); color: var(--success); }
  .badge-err { background: rgba(var(--danger-rgb),0.12); color: var(--danger); }

  /* ── Connection guide ───────────────────────────────────────── */
  .conn-guide {
    margin-bottom: 16px; padding: 18px 20px;
    border: 1px solid rgba(var(--danger-rgb),.25);
    border-radius: 12px; background: rgba(var(--danger-rgb),.04);
  }
  .conn-guide-header {
    display: flex; align-items: center; gap: 8px;
    font-size: 0.8rem; font-weight: 600; color: var(--danger);
    margin-bottom: 14px;
  }
  .guide-steps {
    list-style: none; margin: 0; padding: 0;
    display: flex; flex-direction: column; gap: 12px;
  }
  .guide-steps li {
    display: flex; align-items: flex-start; gap: 10px;
    font-size: 0.76rem; color: var(--text);
  }
  .gs-icon {
    display: flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; flex-shrink: 0; border-radius: 6px;
    background: rgba(var(--warning-rgb),.12); color: var(--warning); margin-top: 1px;
  }
  .guide-steps li strong { display: block; font-weight: 600; margin-bottom: 2px; }
  .gs-detail { display: block; color: var(--muted); margin-top: 2px; }
  .gs-cmd {
    display: block; margin: 5px 0 4px;
    background: var(--surface-1); border: 1px solid var(--border);
    border-radius: 6px; padding: 7px 10px;
    font-size: 0.7rem; font-family: monospace; color: var(--text);
    white-space: pre; overflow-x: auto;
  }

  .conn-warn {
    display: flex; align-items: flex-start; gap: 10px;
    margin-bottom: 16px; padding: 12px 16px;
    border: 1px solid rgba(var(--warning-rgb),.3);
    border-radius: 10px; background: rgba(var(--warning-rgb),.05);
    font-size: 0.76rem; color: var(--warning);
  }
  .conn-warn div { display: flex; flex-direction: column; gap: 2px; }
  .conn-warn strong { font-weight: 600; }
  .conn-warn span { color: var(--muted); font-size: 0.72rem; }
  .saas-unavail { border-color: rgba(var(--danger-rgb),.25); background: rgba(var(--danger-rgb),.04); color: var(--danger); }
  .support-link {
    display: inline-block; margin-top: 8px;
    font-size: 0.74rem; font-weight: 600; color: var(--primary);
    text-decoration: none;
  }
  .support-link:hover { text-decoration: underline; }

  /* ── Auto-poll / reconnect ──────────────────────────────────── */
  .polling-bar {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 12px; padding: 7px 12px; border-radius: 8px;
    background: rgba(var(--warning-rgb),.07);
    border: 1px solid rgba(var(--warning-rgb),.2);
    font-size: 0.72rem; color: var(--muted);
  }
  .poll-dot {
    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
    background: var(--warning);
    animation: pulse 1.6s ease-in-out infinite;
  }
  .spin-dot { animation: pulse 0.8s ease-in-out infinite; }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.4; transform: scale(0.7); }
  }
  .retry-btn {
    margin-left: auto; padding: 3px 10px; border-radius: 6px;
    border: 1px solid rgba(var(--primary-rgb),.3);
    background: transparent; color: var(--primary);
    font-size: 0.7rem; font-weight: 600; cursor: pointer;
  }
  .retry-btn:hover { background: rgba(var(--primary-rgb),.08); }

  .reconnect-flash {
    display: flex; align-items: center; gap: 7px;
    margin-bottom: 12px; padding: 8px 12px; border-radius: 8px;
    background: rgba(var(--success-rgb),.08);
    border: 1px solid rgba(var(--success-rgb),.25);
    font-size: 0.74rem; font-weight: 600; color: var(--success);
    animation: fadeout 2s ease-in-out forwards;
  }
  @keyframes fadeout { 0%,70% { opacity:1; } 100% { opacity:0; } }

  .agent-setup-link { color: var(--primary); text-decoration: none; font-size: 0.72rem; }
  .agent-setup-link:hover { text-decoration: underline; }
</style>
