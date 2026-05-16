<script lang="ts">
  type TableColumn = {
    key: string;
    label: string;
    align?: string;
    toneKey?: string;
  };

  export let columns: TableColumn[] = [];
  export let rows: Record<string, string | number>[] = [];

  function cellTone(row: Record<string, string | number>, key?: string) {
    if (!key) return '';
    const value = String(row[key] ?? '');
    if (value.startsWith('+') || value === 'Buy' || value === 'Strong Buy' || value === 'Connected') return 'text-emerald-300';
    if (value.startsWith('-') || value === 'Trim' || value === 'Disconnected') return 'text-rose-300';
    return 'text-slate-300';
  }

  function alignClass(align = 'left') {
    return align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  }
</script>

<div class="table-wrap">
  <table class="data-table">
    <thead>
      <tr>
        {#each columns as column}
          <th class={alignClass(column.align)}>{column.label}</th>
        {/each}
      </tr>
    </thead>
    <tbody class="divide-y divide-white/10">
      {#each rows as row}
        <tr class="transition hover:bg-white/[0.04]">
          {#each columns as column}
            <td class={`${alignClass(column.align)} ${cellTone(row, column.toneKey)}`}>
              {row[column.key]}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
