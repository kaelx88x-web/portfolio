<script lang="ts">
  import { CheckCircle2, XCircle } from 'lucide-svelte';
  import type { TradeApproval } from '$lib/services/trade-layer.service';

  export let approval: TradeApproval;
</script>

<article class="approval" class:rejected={approval.approvalStatus === 'rejected'}>
  <div class="icon">
    {#if approval.approvalStatus === 'approved'}<CheckCircle2 size={16} />{:else}<XCircle size={16} />{/if}
  </div>
  <div>
    <span>{approval.approvalStatus}</span>
    <h2>{approval.tradeTicketId}</h2>
    <p>{approval.decisionNote}</p>
    <small>{new Date(approval.createdAt).toLocaleString()} by {approval.approvedBy}</small>
  </div>
</article>

<style>
  .approval { border: 1px solid rgba(var(--success-rgb), 0.28); border-radius: 8px; background: var(--card); padding: 12px; display: flex; gap: 10px; align-items: start; }
  .approval.rejected { border-color: rgba(var(--danger-rgb), 0.28); }
  .icon { color: var(--success); margin-top: 2px; }
  .rejected .icon { color: var(--danger); }
  span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  h2 { margin: 3px 0; color: var(--text); font-size: 0.82rem; overflow-wrap: anywhere; }
  p, small { margin: 0; color: var(--muted); font-size: 0.74rem; line-height: 1.45; }
  small { display: block; margin-top: 6px; font-size: 0.66rem; }
</style>
