<script lang="ts">
  import '../app.css';
  import {
    BarChart3,
    BriefcaseBusiness,
    Camera,
    Eye,
    FileUp,
    LayoutDashboard,
    ListChecks,
    RefreshCw,
    Settings,
    WalletCards
  } from 'lucide-svelte';

  const nav = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/accounts', label: 'Accounts', icon: WalletCards },
    { href: '/assets', label: 'Assets', icon: BriefcaseBusiness },
    { href: '/holdings', label: 'Holdings', icon: BarChart3 },
    { href: '/transactions', label: 'Transactions', icon: ListChecks },
    { href: '/broker', label: 'Broker Sync', icon: RefreshCw },
    { href: '/snapshots', label: 'Snapshots', icon: Camera },
    { href: '/import', label: 'Import', icon: FileUp },
    { href: '/watchlist', label: 'Watchlist', icon: Eye },
    { href: '/settings', label: 'Settings', icon: Settings }
  ];
</script>

<svelte:head>
  <title>Portfolio AI</title>
  <meta
    name="description"
    content="Portfolio AI Phase 1 portfolio insight dashboard"
  />
</svelte:head>

<div class="min-h-screen bg-[#eef1f6] text-ink">
  <aside
    class="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-line bg-white px-4 py-5 lg:block"
  >
    <a href="/dashboard" class="mb-7 flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-md bg-ink text-white">
        <BarChart3 size={20} />
      </div>
      <div>
        <div class="text-sm font-bold">Portfolio AI</div>
        <div class="text-xs text-slate-500">Insight foundation</div>
      </div>
    </a>

    <nav class="space-y-1">
      {#each nav as item}
        <a
          href={item.href}
          class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-panel hover:text-ink"
        >
          <svelte:component this={item.icon} size={17} />
          {item.label}
        </a>
      {/each}
    </nav>
  </aside>

  <div class="lg:pl-64">
    <header class="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
      <div class="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <a href="/dashboard" class="flex items-center gap-2 font-bold lg:hidden">
          <BarChart3 size={20} />
          Portfolio AI
        </a>
        <div class="hidden text-sm text-slate-500 lg:block">Phase 2 - Broker Sync</div>
        <div class="rounded-md border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-slate-600">
          Local demo mode
        </div>
      </div>
      <nav class="flex gap-1 overflow-x-auto border-t border-line px-3 py-2 lg:hidden">
        {#each nav as item}
          <a href={item.href} class="whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold text-slate-700">
            {item.label}
          </a>
        {/each}
      </nav>
    </header>

    <main class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <slot />
    </main>
  </div>
</div>
