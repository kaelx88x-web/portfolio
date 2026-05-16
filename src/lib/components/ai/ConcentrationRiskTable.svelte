<script lang="ts">
  import { percent } from '$lib/format';
  export let rows: any[] = [];
</script>

<div class="table-wrap">
  <table>
    <thead><tr><th>Exposure</th><th>Type</th><th>Allocation</th><th>Severity</th><th>Explanation</th></tr></thead>
    <tbody>
      {#each rows as row}
        <tr>
          <td><strong>{row.label}</strong></td>
          <td>{row.type.replaceAll('_', ' ')}</td>
          <td>{percent(row.allocationPct)}</td>
          <td><span class={row.severity}>{row.severity}</span></td>
          <td>{row.explanation}</td>
        </tr>
      {:else}
        <tr><td colspan="5">No concentration rows available.</td></tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .table-wrap { border: 1px solid var(--border); border-radius: 8px; background: var(--card); overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; min-width: 680px; }
  th, td { border-bottom: 1px solid var(--border); padding: 10px; text-align: left; font-size: .74rem; color: var(--text); }
  th { color: var(--muted); font-size: .66rem; text-transform: uppercase; }
  td { color: var(--muted); }
  strong { color: var(--text); }
  span { font-size: .66rem; font-weight: 800; text-transform: uppercase; }
  .critical, .high { color: var(--danger); }
  .medium { color: var(--warning); }
  .low { color: var(--success); }
</style>
