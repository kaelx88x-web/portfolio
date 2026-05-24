<script lang="ts">
  export let score = 0;
  export let label = 'Diversification';

  $: color = score >= 70 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)';
  $: tier = score >= 70 ? 'good' : score >= 50 ? 'fair' : 'low';
</script>

<article class="card">
  <div class="top">
    <span class="label">{label}</span>
    <div class="badge" style="--c:{color}">{tier}</div>
  </div>
  <div class="big" style="color:{color}">{score}<span class="unit">/100</span></div>
  <div class="bar-wrap">
    <div class="bar-fill" style="width:{score}%; background:{color}"></div>
  </div>
</article>

<style>
  .card { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 14px 16px; display: grid; gap: 10px; }
  .top { display: flex; justify-content: space-between; align-items: center; }
  .label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; }
  .badge {
    font-size: 0.58rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 3px 8px; border-radius: 999px;
    background: rgba(from var(--c) r g b / 0.12);
    color: var(--c);
    border: 1px solid rgba(from var(--c) r g b / 0.25);
  }
  .big { font-size: 1.9rem; font-weight: 800; line-height: 1; }
  .unit { font-size: 0.85rem; font-weight: 600; color: var(--muted); margin-left: 2px; }
  .bar-wrap { height: 5px; border-radius: 999px; background: var(--surface-1); overflow: hidden; }
  .bar-fill { height: 100%; border-radius: inherit; transition: width 0.4s ease; }
</style>
