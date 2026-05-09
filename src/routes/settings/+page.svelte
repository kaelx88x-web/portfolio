<script lang="ts">
  export let data;
  export let form;
</script>

<div class="mb-6">
  <h1 class="text-2xl font-bold">Settings</h1>
  <p class="mt-1 text-sm text-slate-500">Local demo user preferences for Phase 1.</p>
</div>

{#if form?.message}
  <div class="mb-4 rounded-md border border-line bg-white px-4 py-3 text-sm">{form.message}</div>
{/if}

<form method="POST" action="?/update" class="card max-w-xl space-y-4 p-5">
  <div>
    <label class="label" for="name">Name</label>
    <input id="name" name="name" class="field mt-1" value={data.user.name} required />
  </div>
  <div>
    <label class="label" for="email">Email</label>
    <input id="email" class="field mt-1 bg-panel" value={data.user.email} disabled />
  </div>
  <div>
    <label class="label" for="baseCurrency">Base currency</label>
    <input id="baseCurrency" name="baseCurrency" class="field mt-1" value={data.user.baseCurrency} maxlength="3" required />
  </div>
  <button class="button">Save settings</button>
</form>
