<script lang="ts">
  import { AlertTriangle, CalendarClock, Coins, ShieldCheck } from 'lucide-svelte';
  import DataTable from '$lib/components/portfolioai/DataTable.svelte';
  import StatCard from '$lib/components/portfolioai/StatCard.svelte';

  const columns = [
    { key: 'type', label: 'Strategy' },
    { key: 'symbol', label: 'Symbol' },
    { key: 'strike', label: 'Strike', align: 'right' },
    { key: 'expiry', label: 'Expiry' },
    { key: 'premium', label: 'Premium', align: 'right' },
    { key: 'status', label: 'Risk Status' }
  ];
  const rows = [
    { type: 'Cash-secured put', symbol: 'NIO', strike: '$6.00', expiry: '2026-05-22', premium: '$53.00', status: 'Elevated' },
    { type: 'Covered call', symbol: 'NIO', strike: '$5.50', expiry: '2026-05-15', premium: '$58.46', status: 'Watch' },
    { type: 'Cash-secured put', symbol: 'O', strike: '$55.00', expiry: '2026-06-19', premium: '$128.00', status: 'Healthy' },
    { type: 'Covered call', symbol: 'MSFT', strike: '$450.00', expiry: '2026-06-19', premium: '$312.00', status: 'Healthy' }
  ];
</script>

<div class="mb-6">
  <h1 class="text-2xl font-bold text-white">Options Wheel Tracker</h1>
  <p class="mt-1 text-sm text-slate-400">Manage cash-secured puts, covered calls, assignments, premiums, and expiry risk.</p>
</div>

<section class="grid gap-4 md:grid-cols-4">
  <StatCard label="Premium Income" value="$1,248" change="This month" tone="emerald" icon={Coins} />
  <StatCard label="Cash-Secured Puts" value="5" change="$18.5k reserved" tone="cyan" icon={ShieldCheck} />
  <StatCard label="Covered Calls" value="4" change="2 near expiry" tone="amber" icon={CalendarClock} />
  <StatCard label="Assignments" value="1" change="NIO watch" tone="rose" icon={AlertTriangle} />
</section>

<section class="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
  <DataTable columns={columns} rows={rows} />
  <div class="card p-5">
    <h2 class="font-bold text-white">Expiry Calendar</h2>
    <div class="mt-5 space-y-3">
      {#each ['May 15 - NIO covered call', 'May 22 - NIO cash-secured put', 'June 19 - O put and MSFT call'] as item}
        <div class="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold text-slate-200">
          {item}
        </div>
      {/each}
    </div>
  </div>
</section>
