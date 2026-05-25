<!-- src/routes/settings/agent/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import { Copy, Check, RefreshCw, Radio, Clock } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import type { PageData, ActionData } from './$types';

  export let data: PageData;
  export let form: ActionData = null;

  $: apiKey = data.apiKey;
  let copied = false;
  let rotating = false;

  async function copyKey() {
    await navigator.clipboard.writeText(apiKey);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
  }

  function relTime(iso: string | null): string {
    if (!iso) return 'Never';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const AGENT_VERSION = '1.0.0';
  $: serverUrl = typeof window !== 'undefined' ? window.location.origin : '';
</script>

<PageHeader
  title="Local Agent"
  subtitle="Connect your PC's Moomoo OpenD to this account."
  breadcrumb={[{ label: 'Settings', href: '/settings' }, { label: 'Agent' }]}
/>

<!-- Status bar -->
<div class="status-bar">
  <span class="dot" class:dot-active={data.status === 'active'} class:dot-pending={data.status !== 'active'}></span>
  <span class="status-text">{data.status === 'active' ? 'Agent active' : 'Waiting for first push'}</span>
  {#if data.lastPushAt}
    <span class="meta"><Clock size={11} /> Last push {relTime(data.lastPushAt)}</span>
  {/if}
  {#if data.lastSeenAt}
    <span class="meta"><Radio size={11} /> Last seen {relTime(data.lastSeenAt)}</span>
  {/if}
</div>

<!-- API Key card -->
<div class="card key-card">
  <div class="card-title">API Key</div>
  <p class="card-desc">This key authenticates your local agent. Keep it secret — it has access to your portfolio data.</p>

  <div class="key-row">
    <code class="key-value">{apiKey}</code>
    <button class="btn-icon" on:click={copyKey} title="Copy key">
      {#if copied}<Check size={14} />{:else}<Copy size={14} />{/if}
    </button>
  </div>

  {#if form?.rotated}
    <div class="rotate-notice">✓ New key generated — update your agent config and restart the agent.</div>
  {/if}

  <form method="POST" action="?/rotate" use:enhance={() => {
    rotating = true;
    return async ({ update }) => { await update(); rotating = false; };
  }}>
    <button class="btn-rotate" type="submit" disabled={rotating}>
      <RefreshCw size={12} class={rotating ? 'spin' : ''} />
      {rotating ? 'Rotating…' : 'Rotate Key'}
    </button>
  </form>
</div>

<!-- Setup guide -->
<div class="card setup-card">
  <div class="card-title">Setup Guide</div>
  <p class="card-desc">Run these steps once on the PC where Moomoo OpenD is installed.</p>

  <ol class="setup-steps">
    <li>
      <strong>Download the agent</strong>
      <span>Copy the <code>portfolio-agent/</code> folder from the project to your PC.</span>
    </li>
    <li>
      <strong>Install dependencies</strong>
      <pre class="cmd">cd portfolio-agent
pip install -r requirements.txt</pre>
    </li>
    <li>
      <strong>Create config file</strong>
      <span>Copy <code>config.example.json</code> → <code>config.json</code> and fill in your values:</span>
      <pre class="cmd">{JSON.stringify({
  server_url: serverUrl || 'https://your-saas-server.com',
  api_key: apiKey,
  moomoo_service_url: 'http://localhost:8001',
  push_interval_seconds: 300
}, null, 2)}</pre>
    </li>
    <li>
      <strong>Start OpenD + moomoo-service</strong>
      <span>Make sure Moomoo OpenD is running, then:</span>
      <pre class="cmd">cd moomoo-service
python main.py</pre>
    </li>
    <li>
      <strong>Run the agent</strong>
      <pre class="cmd">cd portfolio-agent
python agent.py</pre>
      <span>You should see <em>"Push successful"</em> in the terminal. This page will show "Agent active".</span>
    </li>
    <li>
      <strong>Keep it running</strong>
      <span>The agent must be running whenever OpenD is on. You can add it to Windows Task Scheduler to start automatically.</span>
    </li>
  </ol>
</div>

<style>
  .status-bar {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    margin-bottom: 16px; padding: 8px 14px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--card);
    font-size: 0.74rem; color: var(--muted);
  }
  .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .dot-active  { background: var(--success); box-shadow: 0 0 0 3px rgba(var(--success-rgb),.2); }
  .dot-pending { background: var(--muted); }
  .status-text { font-weight: 600; color: var(--text); }
  .meta { display: flex; align-items: center; gap: 4px; }

  .card { padding: 18px 20px; border: 1px solid var(--border); background: var(--card); border-radius: 12px; margin-bottom: 16px; }
  .card-title { font-size: 0.82rem; font-weight: 700; color: var(--text); margin-bottom: 6px; }
  .card-desc  { font-size: 0.74rem; color: var(--muted); margin: 0 0 14px; }

  .key-row {
    display: flex; align-items: center; gap: 8px;
    background: var(--surface-1); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; margin-bottom: 10px;
  }
  .key-value {
    flex: 1; font-family: monospace; font-size: 0.78rem;
    color: var(--text); word-break: break-all;
  }
  .btn-icon {
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
    border: 1px solid var(--border); background: var(--card);
    color: var(--muted); cursor: pointer;
  }
  .btn-icon:hover { color: var(--primary); border-color: var(--primary); }

  .rotate-notice {
    font-size: 0.72rem; color: var(--success); margin-bottom: 10px;
  }
  .btn-rotate {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 7px;
    border: 1px solid rgba(var(--danger-rgb),.3);
    background: transparent; color: var(--danger);
    font-size: 0.74rem; font-weight: 600; cursor: pointer;
  }
  .btn-rotate:hover:not(:disabled) { background: rgba(var(--danger-rgb),.06); }
  .btn-rotate:disabled { opacity: 0.5; cursor: not-allowed; }
  :global(.spin) { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .setup-steps {
    list-style: none; margin: 0; padding: 0;
    display: flex; flex-direction: column; gap: 14px;
    counter-reset: step;
  }
  .setup-steps li {
    display: flex; flex-direction: column; gap: 4px;
    font-size: 0.76rem; color: var(--text);
    padding-left: 28px; position: relative;
  }
  .setup-steps li::before {
    content: counter(step);
    counter-increment: step;
    position: absolute; left: 0; top: 0;
    width: 20px; height: 20px; border-radius: 50%;
    background: rgba(var(--primary-rgb),.12); color: var(--primary);
    font-size: 0.65rem; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
  }
  .setup-steps li strong { font-weight: 600; }
  .setup-steps li span  { color: var(--muted); }
  .cmd {
    display: block; margin: 5px 0;
    background: var(--surface-1); border: 1px solid var(--border);
    border-radius: 6px; padding: 8px 12px;
    font-size: 0.7rem; font-family: monospace; color: var(--text);
    white-space: pre; overflow-x: auto;
  }
</style>
