<script lang="ts">
  import { Link2, RefreshCw } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';

  export let form: {
    message?: string;
    rows?: Array<{ account: string; symbol: string; type: string; tradeDate: string; quantity: number; price: number; fee: number; errors: string[] }>;
    csvContent?: string;
  } | null = null;

  const sample = `account,symbol,type,trade_date,quantity,price,fee,currency,notes
Moomoo US Account,MSFT,buy,2026-05-01,10,420,1,USD,Initial Microsoft buy
Moomoo US Account,AAPL,dividend,2026-05-08,20,0.24,0,USD,Quarterly dividend`;

  $: hasErrors  = form?.rows?.some((r) => r.errors.length > 0) ?? false;
  $: readyCount = form?.rows?.filter((r) => r.errors.length === 0).length ?? 0;
</script>

<PageHeader
  title="CSV Import"
  subtitle="Upload a transaction CSV to import trades, dividends, and deposits."
  breadcrumb={[{ label: 'Portfolio', href: '/dashboard' }, { label: 'Import' }]}
/>

<!-- Feedback banner -->
{#if form?.message}
  <div class="banner" class:banner-ok={!hasErrors} class:banner-err={hasErrors}>
    {form.message}
  </div>
{/if}

<!-- Broker shortcuts -->
<div class="shortcuts">
  <a href="/broker" class="shortcut-card">
    <div class="shortcut-icon"><Link2 size={18} /></div>
    <div class="shortcut-text">
      <span class="shortcut-label">Sync Moomoo</span>
      <span class="shortcut-sub">Live sync from broker</span>
    </div>
    <RefreshCw size={14} class="shortcut-arrow" />
  </a>
</div>

<!-- Upload + format reference -->
<div class="top-grid">
  <!-- Upload card -->
  <div class="card upload-card">
    <div class="card-title">Upload CSV</div>
    <form method="POST" action="?/preview" enctype="multipart/form-data" class="upload-form">
      <label class="file-label" for="csv-input">
        <span class="file-icon">↑</span>
        <span class="file-text">Choose a .csv file</span>
        <input id="csv-input" name="csv" type="file" accept=".csv,text/csv" class="file-input" required />
      </label>
      <button class="btn-primary">Preview Import</button>
    </form>

    {#if form?.csvContent}
      <form method="POST" action="?/confirm" class="confirm-form">
        <textarea name="csvContent" class="hidden">{form.csvContent}</textarea>
        <div class="confirm-row">
          <span class="confirm-hint">{readyCount} row{readyCount !== 1 ? 's' : ''} ready</span>
          <button class="btn-primary" disabled={hasErrors}>Confirm Import</button>
        </div>
      </form>
    {/if}
  </div>

  <!-- Format reference -->
  <div class="card format-card">
    <div class="card-title">Expected Columns</div>
    <p class="format-hint">One row per trade or event. All amounts in the account's base currency.</p>
    <pre class="code-block">{sample}</pre>

    <table class="col-table">
      <thead>
        <tr><th>Column</th><th>Values</th><th>Required</th></tr>
      </thead>
      <tbody>
        <tr><td class="col-name">account</td><td>Account name (must match an existing account)</td><td class="col-req">Yes</td></tr>
        <tr><td class="col-name">symbol</td><td>Ticker (e.g. AAPL, MSFT). Leave blank for cash events.</td><td class="col-req">—</td></tr>
        <tr><td class="col-name">type</td><td>buy · sell · dividend · deposit · withdrawal</td><td class="col-req">Yes</td></tr>
        <tr><td class="col-name">trade_date</td><td>YYYY-MM-DD</td><td class="col-req">Yes</td></tr>
        <tr><td class="col-name">quantity</td><td>Number of shares / units</td><td class="col-req">Yes</td></tr>
        <tr><td class="col-name">price</td><td>Price per share (0 for dividends/deposits)</td><td class="col-req">Yes</td></tr>
        <tr><td class="col-name">fee</td><td>Commission or fee</td><td class="col-req">—</td></tr>
        <tr><td class="col-name">currency</td><td>3-letter ISO code (e.g. USD, MYR)</td><td class="col-req">—</td></tr>
        <tr><td class="col-name">notes</td><td>Free text</td><td class="col-req">—</td></tr>
      </tbody>
    </table>
  </div>
</div>

<!-- Preview table -->
{#if form?.rows?.length}
  <div class="card preview-card">
    <div class="section-header">
      <span class="card-title">Preview</span>
      <span class="row-count">{form.rows.length} rows</span>
      {#if hasErrors}
        <span class="badge-err">Has errors</span>
      {:else}
        <span class="badge-ok">All valid</span>
      {/if}
    </div>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Symbol</th>
            <th>Type</th>
            <th>Date</th>
            <th class="th-r">Qty</th>
            <th class="th-r">Price</th>
            <th class="th-r">Fee</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {#each form.rows as row}
            <tr class:row-err={row.errors.length > 0}>
              <td>{row.account}</td>
              <td class="td-symbol">{row.symbol || '—'}</td>
              <td class="td-type">{row.type}</td>
              <td class="td-muted">{row.tradeDate}</td>
              <td class="td-r">{row.quantity}</td>
              <td class="td-r">{row.price}</td>
              <td class="td-r">{row.fee}</td>
              <td>
                {#if row.errors.length}
                  <span class="status-err">{row.errors.join(', ')}</span>
                {:else}
                  <span class="status-ok">Ready</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}

<style>
  /* Shortcuts */
  .shortcuts { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }

  .shortcut-card {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px; border-radius: 10px;
    border: 1px solid var(--border); background: var(--card);
    text-decoration: none; color: var(--text);
    transition: border-color 0.15s, background 0.15s;
    min-width: 200px;
  }
  .shortcut-card:hover { border-color: var(--primary); background: rgba(var(--primary-rgb),0.05); }

  .shortcut-icon { color: var(--primary); display: flex; }
  .shortcut-text { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .shortcut-label { font-size: 0.82rem; font-weight: 600; }
  .shortcut-sub { font-size: 0.68rem; color: var(--muted); }
  :global(.shortcut-arrow) { color: var(--muted); }

  /* Banner */
  .banner     { margin-bottom: 16px; padding: 10px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 500; border: 1px solid; }
  .banner-ok  { background: rgba(45,212,160,0.08); border-color: rgba(45,212,160,0.3); color: #2dd4a0; }
  .banner-err { background: rgba(249,107,126,0.08); border-color: rgba(249,107,126,0.3); color: #f96b7e; }

  /* Layout */
  .top-grid    { display: grid; grid-template-columns: 1fr 1.6fr; gap: 16px; margin-bottom: 16px; }
  @media (max-width: 900px) { .top-grid { grid-template-columns: 1fr; } }

  .card-title  { font-size: 0.82rem; font-weight: 700; color: var(--text); margin-bottom: 14px; }

  /* Upload card */
  .upload-card  { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  .upload-form  { display: flex; flex-direction: column; gap: 10px; }

  .file-label  { display: flex; align-items: center; gap: 10px; padding: 12px 14px;
                 border: 1px dashed var(--border); border-radius: 8px; cursor: pointer;
                 background: var(--ai-bg); transition: border-color 0.15s; }
  .file-label:hover { border-color: var(--primary); }
  .file-icon   { font-size: 1.1rem; color: var(--primary); }
  .file-text   { font-size: 0.78rem; color: var(--muted); }
  .file-input  { display: none; }

  .btn-primary { padding: 8px 16px; border-radius: 8px; border: none; background: var(--primary);
                 font-size: 0.8rem; font-weight: 600; color: #fff; cursor: pointer; }
  .btn-primary:hover:not(:disabled) { opacity: 0.88; }
  .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

  .confirm-form  { border-top: 1px solid var(--border); padding-top: 14px; }
  .confirm-row   { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .confirm-hint  { font-size: 0.75rem; color: var(--muted); }
  .hidden        { display: none; }

  /* Format card */
  .format-card   { padding: 20px; }
  .format-hint   { font-size: 0.75rem; color: var(--muted); margin-bottom: 12px; }
  .code-block    { background: var(--ai-bg); border: 1px solid var(--border); border-radius: 8px;
                   padding: 12px 14px; font-size: 0.7rem; color: var(--muted);
                   overflow-x: auto; white-space: pre; margin-bottom: 16px; }

  .col-table     { width: 100%; border-collapse: collapse; font-size: 0.73rem; }
  .col-table th  { text-align: left; color: var(--muted); font-weight: 600; font-size: 0.62rem;
                   text-transform: uppercase; letter-spacing: 0.06em; padding: 4px 8px; border-bottom: 1px solid var(--border); }
  .col-table td  { padding: 5px 8px; color: var(--muted); border-bottom: 1px solid var(--border); }
  .col-name      { color: var(--primary); font-weight: 600; white-space: nowrap; }
  .col-req       { text-align: center; color: var(--muted); }

  /* Preview card */
  .preview-card  { padding: 16px; }
  .section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
  .row-count     { font-size: 0.7rem; color: var(--muted); }
  .badge-ok  { font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: 20px;
               background: rgba(var(--success-rgb),0.12); color: var(--success); }
  .badge-err { font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: 20px;
               background: rgba(var(--danger-rgb),0.12); color: var(--danger); }

  /* Table */
  .table-wrap  { overflow-x: auto; }
  .row-err td  { background: rgba(var(--danger-rgb),0.04); }
  .td-symbol   { font-weight: 700; color: var(--primary); }
  .td-type     { color: var(--muted); text-transform: capitalize; }
  .td-muted    { color: var(--muted); }
  .td-r        { text-align: right; }
  .th-r        { text-align: right; }
  .status-ok   { font-size: 0.7rem; font-weight: 600; color: var(--success); }
  .status-err  { font-size: 0.7rem; color: var(--danger); }
</style>
