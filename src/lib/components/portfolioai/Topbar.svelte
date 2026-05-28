<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Bell, ChevronDown, LayoutGrid, Sparkles, Sun, Moon } from 'lucide-svelte';
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import { portfolioSummary } from '$lib/stores/portfolio-summary';
  import { theme } from '$lib/stores/ui';

  export let sidebarCollapsed = false;
  export let aiPanelOpen = false;

  $: isPaperRoute = $page.url.pathname.startsWith('/paper-trading');

  $: paperSummary    = isPaperRoute ? ($page.data?.summary ?? null) : null;

  $: portfolioValue  = paperSummary ? paperSummary.totalValue   : $portfolioSummary.totalValue;
  $: dayChange       = paperSummary ? 0                         : $portfolioSummary.dayChange;
  $: dayChangePct    = paperSummary ? 0                         : $portfolioSummary.dayChangePct;
  $: accountMode     = isPaperRoute ? 'SANDBOX'                 : $portfolioSummary.accountMode;
  $: accountName     = isPaperRoute ? 'Paper Trading'           : accountMode === 'SANDBOX' ? 'Moomoo Simulate' : $portfolioSummary.accountName;

  const dispatch = createEventDispatcher();

  let showAccountMenu = false;

  function formatMoney(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }

  function askAI() {
    goto('/ai/copilot');
  }

  function switchToPaper() {
    showAccountMenu = false;
    goto('/paper-trading');
  }

  // Broker account selector
  interface BrokerAccount {
    acc_id: string;
    trd_env: 'REAL' | 'SIMULATE';
    is_real: boolean;
    is_active: boolean;
    name: string;
  }

  let brokerAccounts: BrokerAccount[] = [];
  let brokerAccountsLoading = false;
  let brokerAccountsError = '';
  let selectingAccId = '';

  async function fetchBrokerAccounts() {
    brokerAccountsLoading = true;
    brokerAccountsError = '';
    try {
      const res = await fetch('/api/broker/accounts');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      brokerAccounts = data as BrokerAccount[];
    } catch (e) {
      brokerAccountsError = 'Bridge offline';
      brokerAccounts = [];
    } finally {
      brokerAccountsLoading = false;
    }
  }

  async function selectBrokerAccount(acc: BrokerAccount) {
    selectingAccId = acc.acc_id;
    try {
      const res = await fetch('/api/broker/accounts/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acc_id: acc.acc_id, trd_env: acc.trd_env, name: acc.name }),
      });
      if (!res.ok) throw new Error('Select failed');
      showAccountMenu = false;
      await invalidateAll();
    } catch {
      brokerAccountsError = 'Failed to switch account';
    } finally {
      selectingAccId = '';
    }
  }

  // Fetch accounts when menu opens (only if not already loaded/loading)
  $: if (showAccountMenu && brokerAccounts.length === 0 && !brokerAccountsLoading) {
    fetchBrokerAccounts();
  }
</script>

<div class="topbar-root">
  <div class="tb" class:paper={isPaperRoute}>
    <!-- Left: logo mark + value hero + account -->
    <div class="tb-left">
      <button class="tb-logo-btn" on:click={() => dispatch('toggleSidebar')} title="Toggle sidebar">
        ◈
      </button>
      <div class="tb-sep"></div>

      <!-- Portfolio value hero -->
      <div class="tb-value-hero">
        <div class="tb-value-label">Total Portfolio</div>
        <div class="tb-value-row">
          <span class="tb-value">{formatMoney(portfolioValue)}</span>
          <span class="tb-change" class:positive={dayChange >= 0} class:negative={dayChange < 0}>
            {dayChange >= 0 ? '+' : ''}{formatMoney(dayChange)} ({dayChangePct >= 0 ? '+' : ''}{dayChangePct.toFixed(2)}%)
          </span>
        </div>
      </div>

      <div class="tb-sep"></div>

      <!-- Account switcher -->
      <div class="tb-account-wrap">
        <button class="tb-account-btn" class:open={showAccountMenu} on:click={() => showAccountMenu = !showAccountMenu}>
          <span class="tb-acc-dot" class:live={accountMode === 'LIVE'} class:sandbox={accountMode === 'SANDBOX'}></span>
          <span class="tb-acc-name">{accountName}</span>
          <span class="tb-acc-badge" class:live={accountMode === 'LIVE'} class:sandbox={accountMode === 'SANDBOX'}>
            {accountMode === 'LIVE' ? 'LIVE' : 'SIMULATE'}
          </span>
          <ChevronDown size={13} />
        </button>

        {#if showAccountMenu}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div class="tb-acc-backdrop" on:click={() => showAccountMenu = false}></div>
          <div class="tb-acc-menu">
            <div class="tb-acc-menu-section">BROKER ACCOUNTS</div>

            {#if brokerAccountsLoading}
              <div class="tb-acc-loading">Loading…</div>
            {:else if brokerAccountsError}
              <div class="tb-acc-error">{brokerAccountsError}</div>
            {:else if brokerAccounts.length === 0}
              <div class="tb-acc-loading">No accounts found</div>
            {:else}
              {#each brokerAccounts as acc}
                <button
                  class="tb-acc-option"
                  class:selected={$portfolioSummary.activeBrokerAccId === acc.acc_id}
                  disabled={selectingAccId === acc.acc_id}
                  on:click={() => selectBrokerAccount(acc)}
                >
                  <span class="tb-acc-dot" class:live={acc.is_real} class:sandbox={!acc.is_real}></span>
                  <span class="tb-acc-opt-label">{acc.name}</span>
                  <span class="tb-acc-id-chip">{acc.acc_id.slice(-6)}</span>
                  {#if selectingAccId === acc.acc_id}
                    <span class="tb-acc-opt-check">…</span>
                  {:else if $portfolioSummary.activeBrokerAccId === acc.acc_id}
                    <span class="tb-acc-opt-check">✓</span>
                  {/if}
                </button>
              {/each}
            {/if}

            <div class="tb-acc-divider"></div>
            <button class="tb-acc-option" on:click={switchToPaper}>
              <span class="tb-acc-symbol">⚗</span>
              <span class="tb-acc-opt-label">Paper Trading</span>
            </button>
          </div>
        {/if}
      </div>
    </div>

    <!-- Right: AI, notifications, avatar, panel toggles -->
    <div class="tb-right">
      <button class="tb-ai-btn" on:click={askAI}>
        <Sparkles size={13} />
        Ask AI
      </button>

      <button class="tb-icon-btn" title="Notifications">
        <Bell size={16} />
        <span class="tb-notif-dot"></span>
      </button>

      <button class="tb-avatar" title="Profile">
        PA
      </button>

      <div class="tb-sep"></div>

      <button
        class="tb-icon-btn"
        class:active={!sidebarCollapsed}
        on:click={() => dispatch('toggleSidebar')}
        title="Toggle sidebar"
      >
        <LayoutGrid size={15} />
      </button>

      <button
        class="tb-icon-btn"
        class:active={aiPanelOpen}
        on:click={() => dispatch('toggleAiPanel')}
        title="Toggle AI panel"
      >
        <Sparkles size={15} />
      </button>

      <div class="tb-sep"></div>

      <button
        class="tb-icon-btn"
        on:click={theme.toggle}
        title={$theme === 'dark' ? 'Light mode' : 'Dark mode'}
      >
        {#if $theme === 'dark'}
          <Sun size={15} />
        {:else}
          <Moon size={15} />
        {/if}
      </button>
    </div>
  </div>
  {#if isPaperRoute}
    <div class="paper-banner">
      <span class="paper-banner-icon">⚠</span>
      <span>You are in paper trading mode — no real money is at risk</span>
    </div>
  {/if}
</div>

<style>
  .tb {
    display: flex; align-items: center; justify-content: space-between;
    height: 56px; padding: 0 16px; gap: 12px;
    background: transparent;
    border-bottom: 1px solid var(--overlay-border);
  }

  .tb-left  { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
  .tb-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

  .tb-sep { width: 1px; height: 20px; background: var(--border); flex-shrink: 0; }

  .tb-logo-btn {
    font-size: 1.1rem; font-weight: 800; color: var(--primary);
    background: none; border: none; cursor: pointer; padding: 0 2px;
    transition: opacity 0.15s;
  }
  .tb-logo-btn:hover { opacity: 0.7; }

  .tb-value-hero { display: flex; flex-direction: column; line-height: 1; }
  .tb-value-label { font-size: 0.5rem; color: var(--muted); font-weight: 500; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.06em; }
  .tb-value-row { display: flex; align-items: baseline; gap: 6px; }
  .tb-value { font-size: 0.95rem; font-weight: 700; color: var(--text); letter-spacing: -0.02em; }
  .tb-change { font-size: 0.65rem; font-weight: 600; }
  .positive { color: var(--success); }
  .negative { color: var(--danger); }

  .tb-account-wrap { position: relative; }

  .tb-account-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 5px 10px; border-radius: 6px;
    background: var(--surface-1); border: 1px solid var(--border);
    font-size: 0.72rem; color: var(--text); cursor: pointer;
    transition: border-color 0.15s;
  }
  .tb-account-btn:hover, .tb-account-btn.open { border-color: rgba(var(--primary-rgb),0.4); }

  .tb-acc-backdrop {
    position: fixed; inset: 0; z-index: 49;
  }

  .tb-acc-menu {
    position: absolute; top: calc(100% + 6px); left: 0;
    min-width: 210px; z-index: 50;
    background: var(--card); border: 1px solid var(--border);
    border-radius: 10px; padding: 6px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  }

  .tb-acc-menu-label {
    font-size: 0.58rem; font-weight: 700; color: var(--muted);
    letter-spacing: 0.08em; text-transform: uppercase;
    padding: 4px 8px 6px;
  }

  .tb-acc-option {
    display: flex; align-items: center; gap: 8px;
    width: 100%; padding: 7px 8px; border-radius: 7px;
    background: none; border: none; cursor: pointer;
    color: var(--text); text-align: left;
    transition: background 0.15s;
  }
  .tb-acc-option:hover { background: rgba(var(--primary-rgb),0.08); }
  .tb-acc-option.selected { background: rgba(var(--primary-rgb),0.1); }

  .tb-acc-opt-text { display: flex; flex-direction: column; gap: 1px; flex: 1; }
  .tb-acc-opt-name { font-size: 0.75rem; font-weight: 600; }
  .tb-acc-opt-sub  { font-size: 0.62rem; color: var(--muted); }
  .tb-acc-opt-check { font-size: 0.75rem; color: var(--primary); font-weight: 700; }

  .tb-acc-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .tb-acc-dot.live    { background: var(--success); }
  .tb-acc-dot.sandbox { background: var(--warning); }

  .tb-acc-name { font-weight: 600; }

  .tb-acc-badge {
    font-size: 0.55rem; font-weight: 700; padding: 1px 5px;
    border-radius: 20px; letter-spacing: 0.06em;
  }
  .tb-acc-badge.live    { background: rgba(var(--success-rgb),0.12); color: var(--success); }
  .tb-acc-badge.sandbox { background: rgba(var(--warning-rgb),0.12); color: var(--warning); }

  .tb-acc-menu-section {
    font-size: 0.58rem; font-weight: 700; letter-spacing: 0.08em;
    color: var(--muted); padding: 8px 12px 4px; text-transform: uppercase;
  }
  .tb-acc-loading { font-size: 0.72rem; color: var(--muted); padding: 8px 12px; }
  .tb-acc-error   { font-size: 0.72rem; color: var(--danger); padding: 8px 12px; }
  .tb-acc-divider { height: 1px; background: var(--border); margin: 4px 0; }
  .tb-acc-id-chip {
    font-size: 0.58rem; font-family: monospace; color: var(--muted);
    background: var(--surface-1); border-radius: 4px; padding: 1px 5px; margin-left: 4px;
    flex-shrink: 0;
  }
  .tb-acc-symbol { font-size: 0.85rem; margin-right: 2px; }
  .tb-acc-opt-label { flex: 1; font-size: 0.75rem; font-weight: 600; }

  .tb-ai-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 6px 12px; border-radius: 6px;
    background: rgba(var(--primary-rgb),0.1); border: 1px solid rgba(var(--primary-rgb),0.25);
    font-size: 0.72rem; font-weight: 600; color: var(--primary);
    cursor: pointer; transition: background 0.15s;
  }
  .tb-ai-btn:hover { background: rgba(var(--primary-rgb),0.18); }

  .tb-icon-btn {
    position: relative;
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: 6px;
    background: var(--surface-1); border: 1px solid var(--border);
    color: var(--muted); cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .tb-icon-btn:hover { border-color: rgba(var(--primary-rgb),0.4); color: var(--text); }
  .tb-icon-btn.active { border-color: rgba(var(--primary-rgb),0.5); color: var(--primary); background: rgba(var(--primary-rgb),0.1); }

  .tb-notif-dot {
    position: absolute; top: 5px; right: 5px;
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--danger); border: 1px solid var(--sidebar-bg);
  }

  .tb-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background: linear-gradient(135deg, var(--primary), #4a5fff);
    font-size: 0.6rem; font-weight: 700; color: #fff;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: none;
  }

  /* ── Mobile ── */
  @media (max-width: 767px) {
    .tb { padding: 0 12px; gap: 8px; }

    /* Hide verbose desktop elements */
    .tb-value-hero  { display: none; }
    .tb-account-wrap { display: none; }
    .tb-ai-btn      { display: none; }

    /* Hide some icon buttons to save space */
    .tb-sep         { display: none; }
  }

  @media (max-width: 480px) {
    /* Extra small — hide notifications too */
    .tb-icon-btn:not(:last-of-type) { display: none; }
  }

  /* ── Paper mode amber treatment ── */
  .tb.paper {
    background: rgba(245,158,11,0.08);
    border-bottom: 2px solid rgba(245,158,11,0.4);
  }

  .topbar-root { display: flex; flex-direction: column; }

  .paper-banner {
    display: flex; align-items: center; gap: 6px;
    height: 24px; padding: 0 16px;
    background: rgba(245,158,11,0.06);
    border-bottom: 1px solid rgba(245,158,11,0.2);
    font-size: 0.7rem; color: var(--warning);
  }
  .paper-banner-icon { font-size: 0.7rem; }
</style>
