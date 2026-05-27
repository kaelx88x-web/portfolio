<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  function fmtCurrency(v: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
  }
</script>

<svelte:head><title>Admin Panel</title></svelte:head>

<div class="p-6 max-w-5xl mx-auto">
  <h1 class="text-2xl font-bold mb-1" style="color:var(--text)">Admin Panel</h1>
  <p class="text-sm mb-6" style="color:var(--muted)">Platform overview and user management</p>

  <div class="grid grid-cols-2 gap-4 md:grid-cols-4 mb-8">
    <!-- Total users -->
    <div class="rounded-xl border p-4" style="border-color:var(--border);background:var(--surface)">
      <div class="text-xs uppercase tracking-wide mb-1" style="color:var(--muted)">Total Users</div>
      <div class="text-3xl font-bold" style="color:var(--text)">{data.totalUsers}</div>
      <div class="text-xs mt-1" style="color:var(--muted)">{data.activeUsers} active (7d)</div>
    </div>
    <!-- Banned -->
    <div class="rounded-xl border p-4" style="border-color:var(--border);background:var(--surface)">
      <div class="text-xs uppercase tracking-wide mb-1" style="color:var(--muted)">Banned</div>
      <div class="text-3xl font-bold" style="color:{data.bannedUsers > 0 ? 'var(--danger)' : 'var(--text)'}">{data.bannedUsers}</div>
      <a href="/admin/users?filter=banned" class="text-xs mt-1" style="color:var(--primary)">Review &rarr;</a>
    </div>
    <!-- AUM -->
    <div class="rounded-xl border p-4" style="border-color:var(--border);background:var(--surface)">
      <div class="text-xs uppercase tracking-wide mb-1" style="color:var(--muted)">Total AUM</div>
      <div class="text-2xl font-bold" style="color:var(--text)">{fmtCurrency(data.totalAum)}</div>
      <div class="text-xs mt-1" style="color:var(--muted)">{data.totalAccounts} accounts</div>
    </div>
    <!-- System -->
    <div class="rounded-xl border p-4" style="border-color:var(--border);background:var(--surface)">
      <div class="text-xs uppercase tracking-wide mb-1" style="color:var(--muted)">System</div>
      <div class="text-sm font-semibold" style="color:var(--text)">DB: healthy ✓</div>
      <div class="text-sm" style="color:{data.bridgeOnline ? 'var(--success)' : 'var(--danger)'}">
        Bridge: {data.bridgeOnline ? 'online ✓' : 'offline ✗'}
      </div>
    </div>
  </div>

  <div class="flex gap-4">
    <a href="/admin/users" class="button">Manage Users &rarr;</a>
  </div>
</div>
