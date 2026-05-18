<script lang="ts">
  export let premium: {
    premium_collected: number;
    collateral_base: number;
    average_premium_yield: number;
    average_annualized_yield: number;
    premium_efficiency_score: number;
  };

  const money = (n: number) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  $: scoreColor = premium.premium_efficiency_score >= 70 ? 'var(--success)' : premium.premium_efficiency_score >= 40 ? 'var(--warning)' : 'var(--danger)';
</script>

<article class="card">
  <div class="head">
    <div>
      <div class="label">Premium Income</div>
      <div class="big">{money(premium.premium_collected)}</div>
    </div>
    <div class="score-box" style="--sc:{scoreColor}">
      <div class="score-val">{premium.premium_efficiency_score}</div>
      <div class="score-lbl">efficiency</div>
    </div>
  </div>

  <div class="rows">
    <div class="row">
      <span>Monthly Yield</span>
      <strong class="green">{premium.average_premium_yield.toFixed(2)}%</strong>
    </div>
    <div class="row">
      <span>Annualized Yield</span>
      <strong class="green">{premium.average_annualized_yield.toFixed(2)}%</strong>
    </div>
    <div class="row">
      <span>Collateral Base</span>
      <strong>{money(premium.collateral_base)}</strong>
    </div>
  </div>
</article>

<style>
  .card { border: 1px solid rgba(var(--success-rgb), 0.25); border-radius: 10px; background: var(--card); padding: 16px; display: grid; gap: 12px; }

  .head { display: flex; justify-content: space-between; align-items: flex-start; }
  .label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; margin-bottom: 4px; }
  .big { font-size: 1.7rem; font-weight: 800; color: var(--success); line-height: 1; }

  .score-box { text-align: center; border: 1px solid rgba(from var(--sc) r g b / 0.3); border-radius: 8px; padding: 8px 12px; background: rgba(from var(--sc) r g b / 0.07); }
  .score-val { font-size: 1.3rem; font-weight: 800; color: var(--sc); line-height: 1; }
  .score-lbl { font-size: 0.58rem; font-weight: 700; text-transform: uppercase; color: var(--muted); margin-top: 2px; letter-spacing: 0.05em; }

  .rows { display: grid; gap: 6px; border-top: 1px solid var(--border); padding-top: 10px; }
  .row { display: flex; justify-content: space-between; align-items: center; }
  span { font-size: 0.72rem; color: var(--muted); }
  strong { font-size: 0.76rem; color: var(--text); }
  .green { color: var(--success); }
</style>
