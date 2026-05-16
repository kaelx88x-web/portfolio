<script lang="ts">
  export let usage: Array<{ totalTokens?: number; requestType?: string }> = [];

  $: totalTokens = usage.reduce((s, r) => s + Number(r.totalTokens ?? 0), 0);
  $: chatCount   = usage.filter((r) => r.requestType === 'chat').length;
</script>

<div class="card usage-card">
  <div class="usage-header">
    <span class="usage-title">AI Usage</span>
    <span class="usage-count">{usage.length} logs</span>
  </div>
  <div class="usage-stats">
    <div class="usage-stat">
      <div class="usage-label">Tokens Used</div>
      <div class="usage-val">{totalTokens.toLocaleString()}</div>
    </div>
    <div class="usage-stat">
      <div class="usage-label">Chat Requests</div>
      <div class="usage-val">{chatCount}</div>
    </div>
  </div>
</div>

<style>
  .usage-card   { padding: 18px; }
  .usage-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .usage-title  { font-size: 0.85rem; font-weight: 700; color: var(--text); }
  .usage-count  { font-size: 0.65rem; font-weight: 600; padding: 2px 8px; border-radius: 20px;
                  background: rgba(var(--primary-rgb),0.1); color: var(--primary); }
  .usage-stats  { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .usage-stat   { background: var(--ai-bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
  .usage-label  { font-size: 0.6rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 6px; }
  .usage-val    { font-size: 1.15rem; font-weight: 700; color: var(--text); }
</style>
