<script lang="ts">
  import type { Account } from '@prisma/client';
  import AccountModeBadge from './badges/AccountModeBadge.svelte';

  export let account: Account;
  export let balance = 0;
  export let dayPnl = 0;
  export let lastSynced: Date | null = null;

  function money(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }
  function timeAgo(d: Date) {
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }

  // Account.accountType and Account.brokerName confirmed in prisma/schema.prisma
  $: mode = account.accountType === 'paper'
    ? 'SANDBOX'
    : account.brokerName
      ? 'LIVE READ-ONLY'
      : 'MANUAL';
</script>

<div class="ac">
  <div class="ac-header">
    <div>
      <div class="ac-name">{account.name}</div>
      {#if account.brokerName}
        <div class="ac-broker">{account.brokerName}</div>
      {/if}
    </div>
    <AccountModeBadge {mode} />
  </div>

  <div class="ac-values">
    <div>
      <div class="ac-label">Balance</div>
      <div class="ac-value">{money(balance)}</div>
    </div>
    <div>
      <div class="ac-label">Day P&amp;L</div>
      <div class="ac-value" class:positive={dayPnl >= 0} class:negative={dayPnl < 0}>
        {dayPnl >= 0 ? '+' : ''}{money(dayPnl)}
      </div>
    </div>
  </div>

  {#if lastSynced}
    <div class="ac-sync">Last synced {timeAgo(lastSynced)}</div>
  {/if}

  <!-- No buy/sell on LIVE accounts — only edit/delete shown -->
  <div class="ac-actions">
    <button class="button-secondary" style="font-size:0.72rem;height:32px;flex:1">Edit</button>
    {#if mode === 'SANDBOX'}
      <a href="/paper-trading" class="button" style="font-size:0.72rem;height:32px;flex:1">Open Sandbox</a>
    {/if}
  </div>
</div>

<style>
  .ac         { background:#0f1523; border:1px solid #1a2038; border-radius:10px; padding:18px; display:flex; flex-direction:column; gap:14px; }
  .ac-header  { display:flex; align-items:flex-start; justify-content:space-between; }
  .ac-name    { font-size:0.9rem; font-weight:700; color:#dce8ff; }
  .ac-broker  { font-size:0.7rem; color:#7a8fb0; margin-top:2px; }
  .ac-values  { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .ac-label   { font-size:0.6rem; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:#7a8fb0; margin-bottom:4px; }
  .ac-value   { font-size:1.1rem; font-weight:700; color:#dce8ff; }
  .ac-sync    { font-size:0.68rem; color:#7a8fb0; }
  .ac-actions { display:flex; gap:8px; }
  .positive   { color:#2dd4a0; }
  .negative   { color:#f96b7e; }
</style>
