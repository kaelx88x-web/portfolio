<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Bell, ChevronDown, LayoutGrid, Sparkles } from 'lucide-svelte';
  import { goto } from '$app/navigation';

  export let sidebarCollapsed = false;
  export let aiPanelOpen = false;

  // These would come from a store in a real implementation; mock for now.
  let portfolioValue = 142830.42;
  let dayChange = 1204.30;
  let dayChangePct = 1.2;
  let accountName = 'Main Portfolio';
  let accountMode: string = 'LIVE';

  const dispatch = createEventDispatcher();

  function formatMoney(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }

  function askAI() {
    goto('/ai/copilot');
  }
</script>

<div class="tb">
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
    <button class="tb-account-btn">
      <span class="tb-acc-dot" class:live={accountMode === 'LIVE'} class:sandbox={accountMode === 'SANDBOX'}></span>
      <span class="tb-acc-name">{accountName}</span>
      <span class="tb-acc-badge" class:live={accountMode === 'LIVE'} class:sandbox={accountMode === 'SANDBOX'}>
        {accountMode === 'LIVE' ? 'LIVE' : 'SANDBOX'}
      </span>
      <ChevronDown size={13} />
    </button>
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
  </div>
</div>

<style>
  .tb {
    display: flex; align-items: center; justify-content: space-between;
    height: 56px; padding: 0 16px; gap: 12px;
  }

  .tb-left  { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .tb-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

  .tb-sep { width: 1px; height: 20px; background: #1a2038; flex-shrink: 0; }

  .tb-logo-btn {
    font-size: 1.1rem; font-weight: 800; color: #6c8fff;
    background: none; border: none; cursor: pointer; padding: 0 2px;
    transition: opacity 0.15s;
  }
  .tb-logo-btn:hover { opacity: 0.7; }

  .tb-value-hero { display: flex; flex-direction: column; line-height: 1; }
  .tb-value-label { font-size: 0.5rem; color: #7a8fb0; font-weight: 500; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.06em; }
  .tb-value-row { display: flex; align-items: baseline; gap: 6px; }
  .tb-value { font-size: 0.95rem; font-weight: 700; color: #dce8ff; letter-spacing: -0.02em; }
  .tb-change { font-size: 0.65rem; font-weight: 600; }
  .positive { color: #2dd4a0; }
  .negative { color: #f96b7e; }

  .tb-account-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 5px 10px; border-radius: 6px;
    background: rgba(255,255,255,0.04); border: 1px solid #1a2038;
    font-size: 0.72rem; color: #dce8ff; cursor: pointer;
    transition: border-color 0.15s;
  }
  .tb-account-btn:hover { border-color: rgba(108,143,255,0.4); }

  .tb-acc-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .tb-acc-dot.live    { background: #2dd4a0; }
  .tb-acc-dot.sandbox { background: #fbbf24; }

  .tb-acc-name { font-weight: 600; }

  .tb-acc-badge {
    font-size: 0.55rem; font-weight: 700; padding: 1px 5px;
    border-radius: 20px; letter-spacing: 0.06em;
  }
  .tb-acc-badge.live    { background: rgba(45,212,160,0.12); color: #2dd4a0; }
  .tb-acc-badge.sandbox { background: rgba(251,191,36,0.12);  color: #fbbf24; }

  .tb-ai-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 6px 12px; border-radius: 6px;
    background: rgba(108,143,255,0.1); border: 1px solid rgba(108,143,255,0.25);
    font-size: 0.72rem; font-weight: 600; color: #6c8fff;
    cursor: pointer; transition: background 0.15s;
  }
  .tb-ai-btn:hover { background: rgba(108,143,255,0.18); }

  .tb-icon-btn {
    position: relative;
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: 6px;
    background: rgba(255,255,255,0.04); border: 1px solid #1a2038;
    color: #7a8fb0; cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .tb-icon-btn:hover { border-color: rgba(108,143,255,0.4); color: #dce8ff; }
  .tb-icon-btn.active { border-color: rgba(108,143,255,0.5); color: #6c8fff; background: rgba(108,143,255,0.1); }

  .tb-notif-dot {
    position: absolute; top: 5px; right: 5px;
    width: 5px; height: 5px; border-radius: 50%;
    background: #f96b7e; border: 1px solid #090e1d;
  }

  .tb-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background: linear-gradient(135deg, #6c8fff, #4a5fff);
    font-size: 0.6rem; font-weight: 700; color: #fff;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: none;
  }
</style>
