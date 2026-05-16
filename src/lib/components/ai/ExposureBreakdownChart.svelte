<script lang="ts">
  export let slices: any[] = [];
</script>

<div class="bars">
  {#each slices.slice(0, 10) as slice}
    <div class="row">
      <div class="meta"><span>{slice.label}</span><strong>{slice.percentage.toFixed(2)}%</strong></div>
      <div class="track"><div class={slice.riskLevel} style={`width:${Math.min(Math.abs(slice.percentage), 100)}%`}></div></div>
    </div>
  {/each}
</div>

<style>
  .bars { display: grid; gap: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  .meta { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 5px; font-size: .72rem; }
  span { color: var(--text); } strong { color: var(--muted); }
  .track { height: 8px; border-radius: 999px; background: rgba(255,255,255,.06); overflow: hidden; }
  .track div { height: 100%; border-radius: inherit; background: var(--success); }
  .track div.medium { background: var(--warning); }
  .track div.high, .track div.critical { background: var(--danger); }
</style>
