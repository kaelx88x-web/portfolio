<script lang="ts">
  import { SlidersHorizontal } from 'lucide-svelte';
  import DataTable from '$lib/components/portfolioai/DataTable.svelte';

  const filters = ['Market cap', 'Dividend yield', 'P/E ratio', 'RSI', 'Sector', 'AI score'];
  const columns = [
    { key: 'symbol', label: 'Symbol' },
    { key: 'company', label: 'Company' },
    { key: 'sector', label: 'Sector' },
    { key: 'pe', label: 'P/E', align: 'right' },
    { key: 'yield', label: 'Yield', align: 'right' },
    { key: 'rsi', label: 'RSI', align: 'right' },
    { key: 'ai', label: 'AI Rating' }
  ];
  const rows = [
    { symbol: 'TSM', company: 'Taiwan Semiconductor', sector: 'Semiconductors', pe: '19.4', yield: '1.7%', rsi: '44', ai: 'Strong Buy' },
    { symbol: 'GOOGL', company: 'Alphabet', sector: 'Communication', pe: '21.1', yield: '0.5%', rsi: '48', ai: 'Buy' },
    { symbol: 'V', company: 'Visa', sector: 'Financials', pe: '28.2', yield: '0.8%', rsi: '51', ai: 'Buy' },
    { symbol: 'O', company: 'Realty Income', sector: 'REIT', pe: '38.7', yield: '5.7%', rsi: '39', ai: 'Hold' }
  ];
</script>

<div class="mb-6">
  <h1 class="text-2xl font-bold text-white">Stock Screener</h1>
  <p class="mt-1 text-sm text-slate-400">Filter equities by fundamentals, technicals, dividend yield, and AI score.</p>
</div>

<section class="mb-6 rounded-lg border border-white/10 bg-white/[0.05] p-5">
  <div class="mb-4 flex items-center gap-2 font-bold text-white">
    <SlidersHorizontal size={18} />
    Filters
  </div>
  <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
    {#each filters as filter}
      <label>
        <span class="label">{filter}</span>
        <select class="field mt-1">
          <option>Any</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
      </label>
    {/each}
  </div>
</section>

<DataTable columns={columns} rows={rows} />
