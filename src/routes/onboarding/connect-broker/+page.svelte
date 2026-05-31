<!-- src/routes/onboarding/connect-broker/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { CheckCircle2, XCircle, Loader2, FlaskConical } from 'lucide-svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  type Step = 1 | 2 | 3;
  let step: Step = data.isReconnect ? 2 : 1;

  type CheckStatus = 'idle' | 'checking' | 'ok' | 'error';
  interface Check { label: string; status: CheckStatus; error: string; }

  let checks: Check[] = [
    { label: 'moomoo-service running', status: 'idle', error: '' },
    { label: 'OpenD connected', status: 'idle', error: '' },
    { label: 'Fetching accounts', status: 'idle', error: '' },
  ];

  type BrokerAccount = { acc_id: string; trd_env: 'REAL' | 'SIMULATE'; is_real: boolean; name: string };
  let accounts: BrokerAccount[] = [];

  let selectedAccId = '';
  let submitting = false;
  let submitError = '';

  function resetChecks() {
    checks = checks.map(c => ({ ...c, status: 'idle' as CheckStatus, error: '' }));
    accounts = [];
    submitError = '';
  }

  async function runChecks() {
    resetChecks();

    // Check 1: moomoo-service
    checks[0] = { ...checks[0], status: 'checking' };
    try {
      const r = await fetch('/api/broker/health/service');
      const d = await r.json() as { ok: boolean; error?: string };
      if (!r.ok || !d.ok) {
        checks[0] = { ...checks[0], status: 'error', error: d.error ?? 'Service unreachable' };
        return;
      }
      checks[0] = { ...checks[0], status: 'ok' };
    } catch {
      checks[0] = { ...checks[0], status: 'error', error: 'moomoo-service not running on port 8001' };
      return;
    }

    // Check 2: OpenD
    checks[1] = { ...checks[1], status: 'checking' };
    try {
      const r = await fetch('/api/broker/health/opend');
      const d = await r.json() as { ok: boolean; error?: string };
      if (!r.ok || !d.ok) {
        checks[1] = { ...checks[1], status: 'error', error: d.error ?? 'OpenD not connected' };
        return;
      }
      checks[1] = { ...checks[1], status: 'ok' };
    } catch {
      checks[1] = { ...checks[1], status: 'error', error: 'Cannot reach OpenD — bridge offline' };
      return;
    }

    // Check 3: accounts
    checks[2] = { ...checks[2], status: 'checking' };
    try {
      const r = await fetch('/api/broker/accounts');
      const d = await r.json() as BrokerAccount[] | { error: string };
      if (!r.ok || 'error' in d) {
        checks[2] = { ...checks[2], status: 'error', error: ('error' in d ? d.error : null) ?? 'Failed to load accounts' };
        return;
      }
      accounts = d;
      if (accounts.length === 0) {
        checks[2] = { ...checks[2], status: 'error', error: 'No accounts found — check OpenD login' };
        return;
      }
      checks[2] = { ...checks[2], status: 'ok' };
      setTimeout(() => { step = 3; }, 500);
    } catch {
      checks[2] = { ...checks[2], status: 'error', error: 'Failed to fetch accounts' };
    }
  }

  async function selectAccount() {
    if (!selectedAccId || submitting) return;
    submitting = true;
    submitError = '';
    const acc = accounts.find(a => a.acc_id === selectedAccId)!;
    try {
      const res = await fetch('/api/broker/accounts/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acc_id: acc.acc_id, trd_env: acc.trd_env, name: acc.name }),
      });
      if (!res.ok) { submitError = 'Failed to save account — try again.'; return; }
      goto('/dashboard');
    } catch {
      submitError = 'Network error — try again.';
    } finally {
      submitting = false;
    }
  }

  $: anyError = checks.some(c => c.status === 'error');
  $: firstError = checks.find(c => c.status === 'error');
  $: allChecking = checks.some(c => c.status === 'checking');
</script>

<div class="ob-root">
  <div class="ob-card">

    <!-- Header -->
    <div class="ob-header">
      <FlaskConical size={24} class="ob-icon" />
      <h1 class="ob-title">Connect a Broker</h1>
      <p class="ob-sub">Paper and live trading are powered by your broker account. No internal simulated account is created.</p>
    </div>

    <!-- Step indicator -->
    <div class="ob-steps">
      {#each ['Choose Broker', 'Connection', 'Select Account'] as label, i}
        <div class="ob-step-item" class:active={step === i + 1} class:done={step > i + 1}>
          <span class="ob-step-num">{step > i + 1 ? '✓' : i + 1}</span>
          <span class="ob-step-label">{label}</span>
        </div>
        {#if i < 2}<div class="ob-step-line" class:done={step > i + 1}></div>{/if}
      {/each}
    </div>

    <!-- ── Step 1: Choose Broker ── -->
    {#if step === 1}
      <div class="ob-section">
        <p class="ob-section-label">Select your broker</p>
        <div class="broker-grid">
          <button class="broker-tile" on:click={() => { step = 2; runChecks(); }}>
            <span class="broker-name">Moomoo</span>
            <span class="broker-avail">Available</span>
          </button>
          <div class="broker-tile disabled">
            <span class="broker-name">Webull</span>
            <span class="broker-soon">Coming Soon</span>
          </div>
          <div class="broker-tile disabled">
            <span class="broker-name">Others</span>
            <span class="broker-soon">Coming Soon</span>
          </div>
        </div>
      </div>
    {/if}

    <!-- ── Step 2: Connection Check ── -->
    {#if step === 2}
      <div class="ob-section">
        <p class="ob-section-label">Checking Moomoo connection</p>

        <div class="check-list">
          {#each checks as check}
            <div class="check-row">
              <span class="check-icon-wrap">
                {#if check.status === 'idle'}
                  <span class="check-idle-dot"></span>
                {:else if check.status === 'checking'}
                  <Loader2 size={15} class="spin muted" />
                {:else if check.status === 'ok'}
                  <CheckCircle2 size={15} class="ok" />
                {:else}
                  <XCircle size={15} class="err" />
                {/if}
              </span>
              <span class="check-label" class:muted-text={check.status === 'idle'}>
                {check.label}
              </span>
            </div>
          {/each}
        </div>

        {#if anyError && firstError}
          <div class="ob-error-msg">{firstError.error}</div>

          <button class="btn-primary" on:click={runChecks} disabled={allChecking}>
            Retry Connection
          </button>

          <details class="dev-details">
            <summary>Developer details</summary>
            <div class="dev-body">
              <p class="dev-hint">Start moomoo-service:</p>
              <pre>cd moomoo-service
python main.py</pre>
              <p class="dev-hint">Confirm OpenD shows "Connected" before retrying.</p>
            </div>
          </details>
        {/if}

        {#if !anyError && checks[0].status === 'idle'}
          <button class="btn-primary" on:click={runChecks}>Start Check</button>
        {/if}
      </div>
    {/if}

    <!-- ── Step 3: Select Account ── -->
    {#if step === 3}
      <div class="ob-section">
        <p class="ob-section-label">Choose your trading account</p>

        <div class="account-list">
          {#each accounts as acc}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
            <label class="account-row" class:selected={selectedAccId === acc.acc_id} on:click={() => selectedAccId = acc.acc_id}>
              <input type="radio" bind:group={selectedAccId} value={acc.acc_id} class="sr-only" />
              <span class="acc-dot" class:live={acc.is_real} class:paper={!acc.is_real}></span>
              <span class="acc-name">{acc.name}</span>
              <span class="acc-type-badge" class:live={acc.is_real} class:paper={!acc.is_real}>
                {acc.is_real ? 'LIVE' : 'PAPER'}
              </span>
              <span class="acc-id-chip">···{acc.acc_id.slice(-6)}</span>
            </label>
          {/each}
        </div>

        {#if submitError}
          <div class="ob-error-msg">{submitError}</div>
        {/if}

        <button class="btn-primary" disabled={!selectedAccId || submitting} on:click={selectAccount}>
          {submitting ? 'Connecting…' : 'Start Trading →'}
        </button>
      </div>
    {/if}

  </div>
</div>

<style>
  .ob-root {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px; background: var(--bg);
  }
  .ob-card {
    width: 100%; max-width: 480px;
    background: var(--card); border: 1px solid var(--border);
    border-radius: 16px; padding: 32px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  }
  .ob-header { text-align: center; margin-bottom: 28px; }
  :global(.ob-icon) { color: var(--primary); margin-bottom: 10px; }
  .ob-title { font-size: 1.2rem; font-weight: 700; color: var(--text); margin: 0 0 8px; }
  .ob-sub { font-size: 0.78rem; color: var(--muted); line-height: 1.5; margin: 0; }
  .ob-steps { display: flex; align-items: center; margin-bottom: 28px; }
  .ob-step-item { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 0 0 auto; }
  .ob-step-num {
    width: 26px; height: 26px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.68rem; font-weight: 700;
    background: var(--surface-1); border: 1px solid var(--border); color: var(--muted);
  }
  .ob-step-item.active .ob-step-num { background: rgba(var(--primary-rgb),0.15); border-color: rgba(var(--primary-rgb),0.5); color: var(--primary); }
  .ob-step-item.done .ob-step-num { background: rgba(var(--success-rgb),0.12); border-color: rgba(var(--success-rgb),0.4); color: var(--success); }
  .ob-step-label { font-size: 0.58rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
  .ob-step-item.active .ob-step-label { color: var(--primary); }
  .ob-step-item.done .ob-step-label { color: var(--success); }
  .ob-step-line { flex: 1; height: 1px; background: var(--border); margin: 0 8px; margin-bottom: 18px; }
  .ob-step-line.done { background: rgba(var(--success-rgb),0.4); }
  .ob-section { display: flex; flex-direction: column; gap: 12px; }
  .ob-section-label { font-size: 0.7rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
  .broker-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
  .broker-tile {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 16px 8px; border-radius: 10px;
    background: var(--surface-1); border: 1.5px solid var(--border);
    cursor: pointer; transition: border-color 0.15s, background 0.15s;
  }
  .broker-tile:not(.disabled):hover { border-color: rgba(var(--primary-rgb),0.5); background: rgba(var(--primary-rgb),0.06); }
  .broker-tile.disabled { opacity: 0.45; cursor: not-allowed; }
  .broker-name { font-size: 0.8rem; font-weight: 700; color: var(--text); }
  .broker-avail { font-size: 0.58rem; font-weight: 700; padding: 2px 6px; border-radius: 10px; background: rgba(var(--success-rgb),0.12); color: var(--success); }
  .broker-soon { font-size: 0.58rem; font-weight: 600; padding: 2px 6px; border-radius: 10px; background: var(--surface-1); color: var(--muted); border: 1px solid var(--border); }
  .check-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 4px; }
  .check-row { display: flex; align-items: center; gap: 10px; font-size: 0.78rem; }
  .check-icon-wrap { width: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .check-idle-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--border); }
  .check-label { color: var(--text); }
  .muted-text { color: var(--muted); }
  :global(.ok) { color: var(--success); }
  :global(.err) { color: var(--danger); }
  :global(.muted) { color: var(--muted); }
  :global(.spin) { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .ob-error-msg { padding: 8px 12px; border-radius: 7px; font-size: 0.74rem; background: rgba(var(--danger-rgb),0.08); border: 1px solid rgba(var(--danger-rgb),0.25); color: var(--danger); }
  .dev-details { border-top: 1px solid var(--border); padding-top: 10px; }
  .dev-details summary { font-size: 0.7rem; color: var(--muted); cursor: pointer; font-weight: 600; user-select: none; }
  .dev-details summary:hover { color: var(--text); }
  .dev-body { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
  .dev-hint { font-size: 0.7rem; color: var(--muted); margin: 0; }
  pre { background: var(--surface-1); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; font-size: 0.7rem; font-family: monospace; color: var(--text); white-space: pre; overflow-x: auto; margin: 0; }
  .account-list { display: flex; flex-direction: column; gap: 8px; }
  .account-row { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 9px; cursor: pointer; border: 1.5px solid var(--border); background: var(--surface-1); transition: border-color 0.15s, background 0.15s; }
  .account-row:hover { border-color: rgba(var(--primary-rgb),0.4); }
  .account-row.selected { border-color: rgba(var(--primary-rgb),0.6); background: rgba(var(--primary-rgb),0.07); }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
  .acc-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .acc-dot.live { background: var(--success); }
  .acc-dot.paper { background: #a5b4fc; }
  .acc-name { flex: 1; font-size: 0.8rem; font-weight: 600; color: var(--text); }
  .acc-type-badge { font-size: 0.58rem; font-weight: 700; padding: 2px 6px; border-radius: 10px; letter-spacing: 0.05em; }
  .acc-type-badge.live { background: rgba(var(--success-rgb),0.12); color: var(--success); }
  .acc-type-badge.paper { background: rgba(99,102,241,0.15); color: #a5b4fc; }
  .acc-id-chip { font-size: 0.62rem; font-family: monospace; color: var(--muted); background: var(--surface-1); border-radius: 4px; padding: 1px 5px; border: 1px solid var(--border); }
  .btn-primary { width: 100%; padding: 10px; border-radius: 8px; background: var(--primary); border: none; color: #fff; font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: opacity 0.15s; }
  .btn-primary:hover:not(:disabled) { opacity: 0.88; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
