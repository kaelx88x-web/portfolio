<script lang="ts">
  import type { CoveredCallCandidate } from '$lib/services/options-intelligence.service';
  export let rows: CoveredCallCandidate[] = [];

  const statusColor = (s: string) => s === 'covered' ? 'green' : s === 'partially_covered' ? 'amber' : 'blue';
  const statusLabel = (s: string) => s === 'covered' ? 'Covered' : s === 'partially_covered' ? 'Partial' : 'Available';
  const cleanSym = (s: string) => s.replace(/^US\./, '');
</script>

<article class="card">
  <div class="card-head">
    <div class="title">Covered Call Candidates</div>
    <div class="count">{rows.length} position{rows.length !== 1 ? 's' : ''}</div>
  </div>

  {#if rows.length > 0}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th class="r">Shares</th>
            <th class="r">Active</th>
            <th class="r">Available</th>
            <th class="r">Suggested Strike</th>
            <th class="r">Est. Premium</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row}
            <tr>
              <td class="sym">{cleanSym(row.symbol)}</td>
              <td class="r">{row.shares_available.toLocaleString()}</td>
              <td class="r {row.active_contracts > 0 ? 'active-call' : 'muted'}">{row.active_contracts > 0 ? row.active_contracts : '—'}</td>
              <td class="r">{row.possible_contracts > 0 ? row.possible_contracts : '—'}</td>
              <td class="r">${row.suggested_strike.toFixed(2)}</td>
              <td class="r prem">
                {#if row.estimated_premium > 0}${row.estimated_premium.toLocaleString()}{:else if row.active_contracts > 0}<span class="roll">Roll opportunity</span>{:else}—{/if}
              </td>
              <td><span class="badge {statusColor(row.coverage_status)}">{statusLabel(row.coverage_status)}</span></td>
            </tr>
            {#if row.coverage_status === 'covered' && row.active_contracts > 0}
              <tr class="note-row"><td colspan="7"><span class="note">✓ {row.active_contracts} active covered call. Consider rolling to a higher strike or later expiry to capture more premium.</span></td></tr>
            {:else if row.note && row.possible_contracts > 0}
              <tr class="note-row"><td colspan="7"><span class="note">{row.note}</span></td></tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="empty">
      <div class="empty-icon">📋</div>
      <div>No 100-share covered call candidates detected.</div>
      <div class="empty-sub">You need at least 100 shares of a stock to sell a covered call.</div>
    </div>
  {/if}
</article>

<style>
  .card { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 16px; display: grid; gap: 12px; }
  .card-head { display: flex; justify-content: space-between; align-items: center; }
  .title { font-size: 0.78rem; font-weight: 700; color: var(--text); }
  .count { font-size: 0.68rem; color: var(--muted); }

  .table-wrap { overflow-x: auto; margin: -4px -4px 0; }
  table { width: 100%; border-collapse: collapse; min-width: 560px; }
  th { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); padding: 6px 10px; border-bottom: 1px solid var(--border); text-align: left; }
  td { font-size: 0.76rem; color: var(--muted); padding: 9px 10px; border-bottom: 1px solid var(--border); }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:last-child.note-row td { border-bottom: none; padding-top: 0; }
  .r { text-align: right; }
  .sym { color: var(--text); font-weight: 800; font-size: 0.8rem; }
  .prem { color: var(--success); font-weight: 700; }
  .muted { color: var(--muted); }
  .active-call { color: var(--primary); font-weight: 700; }
  .roll { font-size: 0.68rem; color: var(--warning); font-weight: 700; }
  .note-row td { padding-top: 2px; padding-bottom: 8px; }
  .note { font-size: 0.68rem; color: var(--muted); font-style: italic; }

  .badge { display: inline-block; font-size: 0.6rem; font-weight: 800; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 999px; }
  .badge.green { background: rgba(var(--success-rgb), 0.12); color: var(--success); }
  .badge.amber { background: rgba(var(--warning-rgb), 0.12); color: var(--warning); }
  .badge.blue { background: rgba(var(--primary-rgb), 0.12); color: var(--primary); }

  .empty { display: grid; gap: 6px; padding: 24px; text-align: center; color: var(--muted); font-size: 0.76rem; }
  .empty-icon { font-size: 1.8rem; }
  .empty-sub { font-size: 0.68rem; }
</style>
