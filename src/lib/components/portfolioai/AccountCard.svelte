<script lang="ts">
  import type { Account } from '@prisma/client';
  import AccountModeBadge from './badges/AccountModeBadge.svelte';

  export let account: Account;
  export let balance = 0;
  export let dayPnl: number | null = null;
  export let lastSynced: Date | null = null;

  function money(n: number, currency = 'USD') {
    return n.toLocaleString('en-US', { style: 'currency', currency, minimumFractionDigits: 2 });
  }
  function timeAgo(d: Date) {
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const TYPE_LABEL: Record<string, string> = {
    brokerage:  'Brokerage',
    paper:      'Paper / Simulated',
    cash:       'Cash',
    crypto:     'Crypto Wallet',
    retirement: 'Retirement',
  };

  type AccountMode = 'LIVE READ-ONLY' | 'SANDBOX' | 'MANUAL';
  $: mode = (account.accountType === 'paper'
    ? 'SANDBOX'
    : account.brokerName
      ? 'LIVE READ-ONLY'
      : 'MANUAL') as AccountMode;

  $: cur = account.currency ?? 'USD';
  $: typeLabel = TYPE_LABEL[account.accountType] ?? account.accountType;
  $: hasDayPnl = dayPnl !== null;

  let showEdit = false;
</script>

<div class="ac">
  <!-- Header -->
  <div class="ac-header">
    <div class="ac-meta">
      <div class="ac-name">{account.name}</div>
      <div class="ac-sub">
        {#if account.brokerName}<span class="ac-broker">{account.brokerName}</span>{/if}
        <span class="ac-type">{typeLabel}</span>
        <span class="ac-cur">{cur}</span>
      </div>
    </div>
    <AccountModeBadge {mode} />
  </div>

  <!-- Stats -->
  <div class="ac-stats">
    <div class="stat">
      <span class="stat-label">Balance</span>
      <span class="stat-val">{money(balance, cur)}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Day P&amp;L</span>
      {#if hasDayPnl}
        <span class="stat-val" class:positive={dayPnl! >= 0} class:negative={dayPnl! < 0}>
          {dayPnl! >= 0 ? '+' : ''}{money(dayPnl!, cur)}
        </span>
      {:else}
        <span class="stat-val muted">—</span>
      {/if}
    </div>
  </div>

  <!-- Footer -->
  <div class="ac-footer">
    {#if lastSynced}
      <span class="ac-sync">Synced {timeAgo(lastSynced)}</span>
    {:else}
      <span class="ac-sync muted">Not synced</span>
    {/if}

    <div class="ac-actions">
      {#if mode === 'SANDBOX'}
        <a href="/paper-trading" class="btn-sec">Open Sandbox</a>
      {/if}
      <button class="btn-sec" on:click={() => (showEdit = !showEdit)}>
        {showEdit ? 'Cancel' : 'Edit'}
      </button>
    </div>
  </div>

  <!-- Inline edit form -->
  {#if showEdit}
    <form method="POST" action="/accounts?/update" class="edit-form">
      <input type="hidden" name="accountId" value={account.id} />
      <div class="edit-row">
        <div>
          <label class="edit-label" for="ename-{account.id}">Name</label>
          <input id="ename-{account.id}" name="name" class="edit-field" value={account.name} required />
        </div>
        <div>
          <label class="edit-label" for="ebroker-{account.id}">Broker</label>
          <input id="ebroker-{account.id}" name="brokerName" class="edit-field" value={account.brokerName ?? ''} />
        </div>
        <div>
          <label class="edit-label" for="etype-{account.id}">Type</label>
          <select id="etype-{account.id}" name="accountType" class="edit-field">
            {#each Object.entries(TYPE_LABEL) as [val, lbl]}
              <option value={val} selected={account.accountType === val}>{lbl}</option>
            {/each}
          </select>
        </div>
        <div>
          <label class="edit-label" for="ecur-{account.id}">Currency</label>
          <input id="ecur-{account.id}" name="currency" class="edit-field" value={cur} maxlength="3" required />
        </div>
      </div>
      <div class="edit-actions">
        <button type="submit" class="btn-primary">Save</button>
        <button type="submit" formaction="/accounts?/delete" class="btn-danger"
          on:click|preventDefault={(e) => { if (confirm('Delete this account?')) (e.currentTarget as HTMLButtonElement).form!.requestSubmit(e.currentTarget as HTMLButtonElement); }}>
          Delete
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .ac          { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:14px; box-shadow:var(--shadow); }

  /* Header */
  .ac-header   { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
  .ac-meta     { display:flex; flex-direction:column; gap:4px; min-width:0; }
  .ac-name     { font-size:0.88rem; font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .ac-sub      { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
  .ac-broker   { font-size:0.68rem; color:var(--muted); }
  .ac-type     { font-size:0.65rem; color:var(--muted); opacity:0.78; }
  .ac-cur      { font-size:0.65rem; color:var(--muted); background:var(--surface-1); border:1px solid var(--border); border-radius:4px; padding:0 5px; }

  /* Stats */
  .ac-stats    { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .stat        { display:flex; flex-direction:column; gap:4px; }
  .stat-label  { font-size:0.6rem; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted); }
  .stat-val    { font-size:1.05rem; font-weight:700; color:var(--text); }
  .positive    { color:var(--success); }
  .negative    { color:var(--danger); }
  .muted       { color:var(--muted); opacity:0.72; }

  /* Footer */
  .ac-footer   { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .ac-sync     { font-size:0.65rem; color:var(--muted); }
  .ac-actions  { display:flex; gap:6px; }

  /* Buttons */
  .btn-sec     { font-size:0.7rem; font-weight:600; padding:4px 10px; height:28px; border-radius:6px;
                 background:transparent; border:1px solid var(--border); color:var(--muted); cursor:pointer;
                 text-decoration:none; display:inline-flex; align-items:center; }
  .btn-sec:hover { border-color:rgba(var(--primary-rgb),0.5); color:var(--text); }

  /* Edit form */
  .edit-form   { border-top:1px solid var(--border); padding-top:14px; display:flex; flex-direction:column; gap:12px; }
  .edit-row    { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .edit-label  { font-size:0.65rem; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); display:block; margin-bottom:4px; }
  .edit-field  { width:100%; background:var(--bg); border:1px solid var(--border); border-radius:6px;
                 padding:6px 10px; font-size:0.78rem; color:var(--text); box-sizing:border-box; }
  .edit-field:focus { outline:none; border-color:rgba(var(--primary-rgb),0.65); box-shadow:0 0 0 2px rgba(var(--primary-rgb),0.12); }
  .edit-actions { display:flex; gap:8px; }
  .btn-primary  { font-size:0.72rem; font-weight:600; padding:5px 14px; height:30px; border-radius:6px;
                  background:var(--primary); border:none; color:#fff; cursor:pointer; }
  .btn-primary:hover { opacity:0.9; }
  .btn-danger   { font-size:0.72rem; font-weight:600; padding:5px 14px; height:30px; border-radius:6px;
                  background:transparent; border:1px solid rgba(var(--danger-rgb),0.4); color:var(--danger); cursor:pointer; }
  .btn-danger:hover { background:rgba(var(--danger-rgb),0.1); }
</style>
