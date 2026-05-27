<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData } from './$types';
  export let data: PageData;

  let search = data.search ?? '';

  function formatDate(d: Date | string) {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
</script>

<svelte:head><title>Users — Admin</title></svelte:head>

<div class="p-6 max-w-5xl mx-auto">
  <div class="flex items-center gap-4 mb-6">
    <a href="/admin" class="text-sm" style="color:var(--muted)">&larr; Admin</a>
    <h1 class="text-2xl font-bold" style="color:var(--text)">Users</h1>
  </div>

  <!-- Search -->
  <form method="GET" class="mb-4">
    <input
      name="search"
      class="field w-64"
      placeholder="Search email or name..."
      value={search}
    />
    <button class="button ml-2" type="submit">Search</button>
    {#if data.filter === 'banned'}
      <a href="/admin/users" class="ml-3 text-sm" style="color:var(--primary)">Clear filter</a>
    {/if}
  </form>

  <!-- User table -->
  <div class="rounded-xl border overflow-hidden" style="border-color:var(--border)">
    <table class="w-full text-sm">
      <thead style="background:var(--surface-alt)">
        <tr>
          <th class="text-left p-3" style="color:var(--muted)">Name</th>
          <th class="text-left p-3" style="color:var(--muted)">Email</th>
          <th class="text-left p-3" style="color:var(--muted)">Joined</th>
          <th class="text-left p-3" style="color:var(--muted)">Status</th>
          <th class="text-left p-3" style="color:var(--muted)">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each data.users as user}
          <tr class="border-t" style="border-color:var(--border)">
            <td class="p-3" style="color:var(--text)">{user.name}</td>
            <td class="p-3" style="color:var(--muted)">{user.email}</td>
            <td class="p-3" style="color:var(--muted)">{formatDate(user.createdAt)}</td>
            <td class="p-3">
              {#if user.banned}
                <span class="px-2 py-0.5 rounded text-xs" style="background:var(--danger-bg);color:var(--danger)">Banned</span>
              {:else if user.role === 'admin'}
                <span class="px-2 py-0.5 rounded text-xs" style="background:var(--primary-bg);color:var(--primary)">Admin</span>
              {:else}
                <span class="px-2 py-0.5 rounded text-xs" style="background:var(--surface-alt);color:var(--success)">Active</span>
              {/if}
            </td>
            <td class="p-3">
              <div class="flex gap-2">
                <a href="/admin/users/{user.id}" class="text-xs" style="color:var(--primary)">View</a>
                {#if user.banned}
                  <form method="POST" action="?/unban" use:enhance>
                    <input type="hidden" name="userId" value={user.id} />
                    <button type="submit" class="text-xs" style="color:var(--success)">Unban</button>
                  </form>
                {:else if user.role !== 'admin'}
                  <form method="POST" action="?/ban" use:enhance>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="reason" value="Banned by admin" />
                    <button type="submit" class="text-xs" style="color:var(--danger)">Ban</button>
                  </form>
                {/if}
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if data.users.length === 0}
      <p class="p-6 text-center text-sm" style="color:var(--muted)">No users found.</p>
    {/if}
  </div>
</div>
