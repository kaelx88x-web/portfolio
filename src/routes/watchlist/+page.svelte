<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import EmptyState from '$lib/components/portfolioai/EmptyState.svelte';

  export let data: PageData;
  export let form: ActionData;

  $: items = data.items ?? [];

  let symbol = '';
  let notes = '';
  let showAddForm = false;
</script>

<div class="page-top">
  <PageHeader
    title="Watchlist"
    subtitle="Track ideas and signals before they become positions."
    breadcrumb={[{ label: 'Portfolio', href: '/dashboard' }, { label: 'Watchlist' }]}
  />
  <div class="page-actions">
    <button class="btn-primary" on:click={() => showAddForm = !showAddForm}>
      {showAddForm ? 'Cancel' : '+ Add Symbol'}
    </button>
  </div>
</div>

{#if showAddForm}
  <div class="add-card">
    <form
      method="POST"
      action="?/add"
      use:enhance={() => {
        return ({ result, update }) => {
          if (result.type === 'success') {
            symbol = '';
            notes = '';
            showAddForm = false;
          }
          update();
        };
      }}
    >
      <div class="add-row">
        <div class="field-wrap">
          <label class="label" for="symbol">Symbol</label>
          <input
            id="symbol"
            name="symbol"
            class="field"
            placeholder="e.g. AAPL, TSLA"
            bind:value={symbol}
            autocomplete="off"
            required
          />
        </div>
        <div class="field-wrap field-notes">
          <label class="label" for="notes">Notes (optional)</label>
          <input
            id="notes"
            name="notes"
            class="field"
            placeholder="e.g. Watching for breakout above 200"
            bind:value={notes}
          />
        </div>
        <button type="submit" class="btn-primary btn-add">Add</button>
      </div>
      {#if form?.error}
        <div class="form-error">{form.error}</div>
      {/if}
    </form>
  </div>
{/if}

{#if items.length === 0}
  <EmptyState
    icon="◎"
    title="Watchlist is empty"
    description="Add symbols to track ideas before they become holdings."
  />
{:else}
  <div class="table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Name</th>
          <th>Watchlist</th>
          <th>Notes</th>
          <th style="width:60px"></th>
        </tr>
      </thead>
      <tbody>
        {#each items as item}
          <tr>
            <td><span class="symbol-badge">{item.symbol}</span></td>
            <td class="name-cell">{item.name ?? '—'}</td>
            <td class="muted">{item.watchlistName ?? '—'}</td>
            <td class="muted">{item.notes ?? '—'}</td>
            <td>
              <form method="POST" action="?/remove" use:enhance>
                <input type="hidden" name="itemId" value={item.id} />
                <button type="submit" class="btn-remove" title="Remove">✕</button>
              </form>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .page-top    { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .page-actions { display: flex; gap: 8px; }

  .btn-primary {
    display: inline-flex; align-items: center; gap: 6px;
    height: 36px; padding: 0 16px; border-radius: 6px;
    background: var(--primary); color: #fff;
    font-size: 0.8rem; font-weight: 600; border: none; cursor: pointer;
    transition: opacity 0.15s;
  }
  .btn-primary:hover { opacity: 0.85; }

  .add-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px 20px;
    margin-bottom: 20px;
  }

  .add-row {
    display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap;
  }

  .field-wrap { display: flex; flex-direction: column; gap: 4px; flex: 0 0 160px; }
  .field-notes { flex: 1 1 260px; }

  .btn-add { align-self: flex-end; flex-shrink: 0; }

  .form-error {
    margin-top: 10px;
    font-size: 0.78rem;
    color: var(--danger);
  }

  .symbol-badge {
    font-size: 0.78rem; font-weight: 700;
    color: var(--primary);
    background: rgba(108,143,255,0.1);
    padding: 2px 8px; border-radius: 4px;
    letter-spacing: 0.04em;
  }

  .name-cell { color: var(--text); }
  .muted { color: var(--muted); font-size: 0.82rem; }

  .btn-remove {
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 6px;
    background: transparent; border: 1px solid transparent;
    color: var(--muted); font-size: 0.7rem;
    cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .btn-remove:hover {
    background: rgba(249,107,126,0.1);
    border-color: rgba(249,107,126,0.3);
    color: var(--danger);
  }
</style>
