<script lang="ts">
  export let score = 0;
  export let level = 'low';
  export let warnings: string[] = [];

  const color = level === 'high' ? 'var(--danger)' : level === 'medium' ? 'var(--warning)' : 'var(--success)';
  const label = level === 'high' ? 'High Risk' : level === 'medium' ? 'Moderate' : 'Low Risk';
</script>

<article class="card">
  <div class="label">Assignment Risk</div>

  <div class="score-row">
    <div class="score" style="--c:{color}">{score}<span>/100</span></div>
    <div class="pill" style="--c:{color}">{label}</div>
  </div>

  <div class="bar-track">
    <div class="bar-fill" style="width:{score}%; background:{color}"></div>
    <div class="bar-mark" style="left:70%"></div>
  </div>
  <div class="bar-labels"><span>Safe</span><span>Warning zone →</span></div>

  {#if warnings.length > 0}
    <ul class="warns">
      {#each warnings.slice(0, 3) as w}<li>{w}</li>{/each}
    </ul>
  {/if}
</article>

<style>
  .card { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 16px; display: grid; gap: 10px; }
  .label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; }

  .score-row { display: flex; justify-content: space-between; align-items: center; }
  .score { font-size: 1.8rem; font-weight: 800; color: var(--c); line-height: 1; }
  .score span { font-size: 0.9rem; font-weight: 600; color: var(--muted); }
  .pill { font-size: 0.62rem; font-weight: 800; letter-spacing: 0.07em; padding: 4px 10px; border-radius: 999px; background: rgba(from var(--c) r g b / 0.12); color: var(--c); border: 1px solid rgba(from var(--c) r g b / 0.25); }

  .bar-track { height: 7px; border-radius: 999px; background: var(--surface-1); position: relative; overflow: visible; }
  .bar-fill { height: 100%; border-radius: 999px; transition: width 0.5s ease; }
  .bar-mark { position: absolute; top: -3px; height: 13px; width: 2px; background: rgba(var(--warning-rgb), 0.6); border-radius: 1px; }
  .bar-labels { display: flex; justify-content: space-between; font-size: 0.6rem; color: var(--muted); margin-top: 2px; }

  .warns { margin: 0; padding: 0; list-style: none; display: grid; gap: 5px; border-top: 1px solid var(--border); padding-top: 8px; }
  .warns li { font-size: 0.71rem; color: var(--warning); padding-left: 14px; position: relative; line-height: 1.4; }
  .warns li::before { content: '⚠'; position: absolute; left: 0; font-size: 0.62rem; }
</style>
