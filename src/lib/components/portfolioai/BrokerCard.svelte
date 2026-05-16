<script lang="ts">
  import { RefreshCw, ShieldCheck } from 'lucide-svelte';

  export let name: string;
  export let status: 'Connected' | 'Available' | 'Disconnected';
  export let lastSync: string;
  export let assets: string;
</script>

<article class="card p-5">
  <div class="flex items-start justify-between gap-3">
    <div>
      <h3 class="font-bold text-white">{name}</h3>
      <p class="mt-1 text-sm text-slate-400">{assets}</p>
    </div>
    <span
      class={`rounded-md border px-2 py-1 text-xs font-semibold ${
        status === 'Connected'
          ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
          : 'border-white/10 bg-white/[0.06] text-slate-300'
      }`}
    >
      {status}
    </span>
  </div>
  <div class="mt-5 flex items-center gap-2 text-sm text-slate-400">
    <ShieldCheck size={15} />
    Last sync: {lastSync}
  </div>
  <button class="button-secondary mt-5 w-full">
    <RefreshCw size={16} />
    Import transactions
  </button>
</article>
