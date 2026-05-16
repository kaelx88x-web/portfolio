<script lang="ts">
  import { CalendarDays, DollarSign, Percent, Repeat2 } from 'lucide-svelte';
  import ChartCard from '$lib/components/portfolioai/ChartCard.svelte';
  import DataTable from '$lib/components/portfolioai/DataTable.svelte';
  import StatCard from '$lib/components/portfolioai/StatCard.svelte';

  const columns = [
    { key: 'month', label: 'Month' },
    { key: 'income', label: 'Projected Income', align: 'right' },
    { key: 'topPayer', label: 'Top Payer' },
    { key: 'tax', label: 'Tax Estimate', align: 'right' }
  ];
  const rows = [
    { month: 'May', income: '$742.20', topPayer: 'SCHD', tax: '$111.33' },
    { month: 'June', income: '$881.40', topPayer: 'SPYT', tax: '$132.21' },
    { month: 'July', income: '$804.10', topPayer: 'O', tax: '$120.62' },
    { month: 'August', income: '$842.50', topPayer: 'SCHD', tax: '$126.38' }
  ];
</script>

<div class="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
  <div>
    <h1 class="text-2xl font-bold text-white">Dividend Planner</h1>
    <p class="mt-1 text-sm text-slate-400">Project monthly income, calendar payouts, taxes, and reinvestment scenarios.</p>
  </div>
  <label class="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-200">
    <input type="checkbox" checked class="h-4 w-4 accent-cyan-300" />
    Reinvestment on
  </label>
</div>

<section class="grid gap-4 md:grid-cols-3">
  <StatCard label="Monthly Income Projection" value="$842.50" change="+7.1% next quarter" tone="emerald" icon={DollarSign} />
  <StatCard label="Annualized Income" value="$10,110" change="7.9% yield on cost" tone="cyan" icon={CalendarDays} />
  <StatCard label="Tax Estimate" value="$1,516" change="15% blended" tone="amber" icon={Percent} />
</section>

<section class="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
  <ChartCard title="Monthly Income Projection" subtitle="Forward 12 months" points={[55, 62, 58, 71, 64, 79, 74, 82, 80, 88, 91, 96]} labels={['M', 'J', 'J', 'A', 'S', 'O', 'N', 'D', 'J', 'F', 'M', 'A']} />
  <div class="card p-5">
    <div class="mb-4 flex items-center gap-2">
      <Repeat2 size={18} class="text-cyan-200" />
      <h2 class="font-bold text-white">Dividend Calendar</h2>
    </div>
    <DataTable columns={columns} rows={rows} />
  </div>
</section>
