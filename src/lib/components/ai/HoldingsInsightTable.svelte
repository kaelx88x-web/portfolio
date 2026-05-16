<script lang="ts">
  import { money, percent } from '$lib/format';

  export let holdings: any[] = [];
</script>

<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>Holding</th>
        <th>Role</th>
        <th>Allocation</th>
        <th>Value</th>
        <th>P/L</th>
        <th>Assistant Insight</th>
      </tr>
    </thead>
    <tbody>
      {#each holdings as row}
        <tr>
          <td>
            <strong>{row.symbol}</strong>
            <span>{row.name}</span>
          </td>
          <td>{row.role}</td>
          <td>{percent(row.allocationPct)}</td>
          <td>{money(row.marketValue)}</td>
          <td class:negative={row.unrealizedPnl < 0}>{money(row.unrealizedPnl)}</td>
          <td>
            <span>{row.insight}</span>
            <small>{row.riskNote}</small>
          </td>
        </tr>
      {:else}
        <tr><td colspan="6">No holdings insight available.</td></tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .table-wrap {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 760px;
  }

  th,
  td {
    border-bottom: 1px solid var(--border);
    padding: 10px;
    text-align: left;
    vertical-align: top;
    font-size: 0.74rem;
  }

  th {
    color: var(--muted);
    font-size: 0.66rem;
    text-transform: uppercase;
  }

  td {
    color: var(--text);
  }

  strong,
  span,
  small {
    display: block;
  }

  td span,
  small {
    color: var(--muted);
    line-height: 1.4;
  }

  small {
    margin-top: 4px;
    font-size: 0.68rem;
  }

  .negative {
    color: var(--danger);
  }
</style>
