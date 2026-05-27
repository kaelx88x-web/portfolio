<script lang="ts">
  import { AlertTriangle } from 'lucide-svelte';

  // Better Auth sets impersonatedBy on the session object when admin impersonates
  export let impersonatedBy: string | null = null;
  export let impersonatedEmail: string = '';
</script>

{#if impersonatedBy}
  <div
    style="
      position:fixed;top:0;left:0;right:0;z-index:9999;
      background:#7c1d1d;border-bottom:1px solid #f85149;
      padding:8px 16px;display:flex;align-items:center;justify-content:space-between;
      font-size:13px;color:#fff;
    "
  >
    <span style="display:flex;align-items:center;gap:8px">
      <AlertTriangle size={15} />
      Viewing as <strong>{impersonatedEmail}</strong> — you are in impersonation mode
    </span>
    <form method="POST" action="/api/auth/admin/stop-impersonating">
      <button
        type="submit"
        style="background:#f85149;border:none;color:#fff;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px"
      >
        Stop &amp; Return to Admin
      </button>
    </form>
  </div>
  <!-- Push content down so banner doesn't overlap -->
  <div style="height:41px"></div>
{/if}
