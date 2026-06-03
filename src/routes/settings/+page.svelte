<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import { liveSettings } from '$lib/stores/live-settings';

  export let data: PageData;
  export let form: ActionData = null;

  const notifToggles = [
    'AI risk alerts',
    'Dividend reminders',
    'Broker sync emails',
    'Options expiry warnings'
  ];
</script>

<PageHeader title="Settings" subtitle="Profile, preferences, and data settings." />

{#if form?.message}
  <div class="msg-banner">{form.message}</div>
{/if}

<div class="settings-grid">
  <!-- Profile form -->
  <form method="POST" action="?/update" use:enhance class="card settings-card">
    <h2 class="section-title">Profile</h2>

    <label class="field-group">
      <span class="label">Name</span>
      <input class="field mt-1" name="name" value={data.user.name} required />
    </label>

    <label class="field-group">
      <span class="label">Email</span>
      <input class="field mt-1 field-disabled" value={data.user.email} disabled />
    </label>

    <label class="field-group">
      <span class="label">Base Currency</span>
      <input class="field mt-1" name="baseCurrency" value={data.user.baseCurrency ?? 'USD'} maxlength="3" required />
    </label>

    <button class="button-primary" type="submit">Save Settings</button>
  </form>

  <div class="right-col">
    <!-- Notifications -->
    <section class="card settings-card">
      <h2 class="section-title">Notifications</h2>
      <div class="toggle-grid">
        {#each notifToggles as toggle}
          <label class="toggle-row">
            <span class="toggle-label">{toggle}</span>
            <input type="checkbox" class="toggle-check" />
          </label>
        {/each}
      </div>
    </section>

    <!-- Live prices -->
    <section class="card settings-card">
      <h2 class="section-title">Live prices</h2>
      <div class="live-settings-grid">
        <label class="field-group">
          <span class="label">Refresh interval</span>
          <select class="field mt-1" bind:value={$liveSettings.refreshIntervalMs}>
            <option value={10_000}>10s</option>
            <option value={30_000}>30s</option>
            <option value={60_000}>60s</option>
          </select>
        </label>
        <label class="toggle-row">
          <span class="toggle-label">Enable live prices by default</span>
          <input type="checkbox" class="toggle-check" bind:checked={$liveSettings.enabledByDefault} />
        </label>
        <label class="toggle-row">
          <span class="toggle-label">Show delayed-data warning</span>
          <input type="checkbox" class="toggle-check" bind:checked={$liveSettings.showDelayedWarning} />
        </label>
      </div>
    </section>

    <!-- Data & Privacy -->
    <section class="card settings-card">
      <h2 class="section-title">Data & Privacy</h2>
      <p class="info-text">
        All portfolio data is stored locally in your SQLite database. No data is sent to external servers except for broker sync via your local OpenD instance.
      </p>
      <div class="action-row">
        <button class="button-secondary" type="button">Export Data</button>
        <button class="button-secondary button-danger" type="button">Reset Workspace</button>
      </div>
    </section>
  </div>
</div>

<style>
  .settings-grid { display: grid; gap: 16px; }
  @media (min-width: 900px) { .settings-grid { grid-template-columns: 0.85fr 1.15fr; align-items: start; } }

  .settings-card { padding: 20px; }
  .right-col { display: flex; flex-direction: column; gap: 16px; }

  .section-title { font-size: 0.85rem; font-weight: 700; color: var(--text); margin-bottom: 16px; }

  .field-group { display: block; margin-bottom: 14px; }
  .label       { font-size: 0.72rem; font-weight: 600; color: var(--muted); }
  .field-disabled { opacity: 0.5; cursor: not-allowed; }

  .button-primary {
    margin-top: 6px;
    display: inline-flex; align-items: center;
    padding: 8px 18px; border-radius: 8px;
    background: var(--primary); border: none;
    font-size: 0.8rem; font-weight: 600; color: #fff;
    cursor: pointer; transition: opacity 0.15s;
  }
  .button-primary:hover { opacity: 0.85; }

  .msg-banner {
    margin-bottom: 16px; padding: 10px 14px;
    border-radius: 8px; font-size: 0.8rem; font-weight: 500;
    background: rgba(var(--primary-rgb),0.08); border: 1px solid rgba(var(--primary-rgb),0.3); color: var(--primary);
  }

  .toggle-grid { display: grid; gap: 10px; grid-template-columns: 1fr 1fr; }
  .toggle-row  {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 14px; border-radius: 8px;
    background: var(--surface-1); border: 1px solid var(--border);
    cursor: pointer;
  }
  .toggle-label { font-size: 0.78rem; font-weight: 600; color: var(--text); }
  .toggle-check { accent-color: var(--primary); cursor: pointer; }

  .info-text { font-size: 0.78rem; color: var(--muted); line-height: 1.65; margin-bottom: 14px; }

  .action-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .button-secondary {
    padding: 7px 14px; border-radius: 8px;
    background: var(--surface-1); border: 1px solid var(--border);
    font-size: 0.75rem; font-weight: 600; color: var(--text);
    cursor: pointer; transition: border-color 0.15s;
  }
  .button-secondary:hover { border-color: rgba(var(--primary-rgb),0.4); }
  .button-danger { color: var(--danger); }
  .button-danger:hover { border-color: rgba(var(--danger-rgb),0.4); }

  .live-settings-grid { display: flex; flex-direction: column; gap: 10px; }
  .live-settings-grid select.field { width: 100%; }
</style>
