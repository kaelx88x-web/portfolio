<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  function fmtDate(d: Date | string) {
    return new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' });
  }

  function fmtCurrency(v: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
  }
</script>

<svelte:head><title>{data.targetUser.name} — Admin</title></svelte:head>

<div class="p-6 max-w-3xl mx-auto">
  <div class="flex items-center gap-4 mb-6">
    <a href="/admin/users" class="text-sm" style="color:var(--muted)">&larr; Users</a>
    <h1 class="text-2xl font-bold" style="color:var(--text)">{data.targetUser.name}</h1>
    {#if data.targetUser.banned}
      <span class="px-2 py-0.5 rounded text-xs" style="background:var(--danger-bg);color:var(--danger)">Banned</span>
    {/if}
  </div>

  <div class="rounded-xl border p-5 mb-4" style="border-color:var(--border);background:var(--surface)">
    <h2 class="font-semibold mb-3" style="color:var(--text)">Account Info</h2>
    <dl class="grid grid-cols-2 gap-y-2 text-sm">
      <dt style="color:var(--muted)">Email</dt><dd style="color:var(--text)">{data.targetUser.email}</dd>
      <dt style="color:var(--muted)">Role</dt><dd style="color:var(--text)">{data.targetUser.role ?? 'user'}</dd>
      <dt style="color:var(--muted)">Joined</dt><dd style="color:var(--text)">{fmtDate(data.targetUser.createdAt)}</dd>
      <dt style="color:var(--muted)">Onboarding</dt><dd style="color:var(--text)">{data.targetUser.onboardingCompleted ? 'Complete' : 'In progress'}</dd>
      {#if data.targetUser.banReason}
        <dt style="color:var(--muted)">Ban reason</dt><dd style="color:var(--danger)">{data.targetUser.banReason}</dd>
      {/if}
    </dl>
  </div>

  <div class="rounded-xl border p-5 mb-4" style="border-color:var(--border);background:var(--surface)">
    <h2 class="font-semibold mb-3" style="color:var(--text)">Portfolio</h2>
    {#if data.latestSnapshot}
      <p class="text-sm" style="color:var(--text)">
        Latest value: <strong>{fmtCurrency(data.latestSnapshot.totalValue)}</strong>
        (as of {fmtDate(data.latestSnapshot.createdAt)})
      </p>
    {:else}
      <p class="text-sm" style="color:var(--muted)">No snapshot yet.</p>
    {/if}
    <p class="text-sm mt-2" style="color:var(--muted)">{data.accounts.length} account(s)</p>
  </div>
</div>
