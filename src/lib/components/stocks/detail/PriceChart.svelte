<!-- PriceChart.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getChartTheme } from '$lib/echarts.config';
  import { theme } from '$lib/stores/ui';

  export let symbol: string;
  export let initial: { t: string; o: number; h: number; l: number; c: number }[] = [];

  type Candle = { t: string; o: number; h: number; l: number; c: number };
  const RANGES = ['1D', '1W', '1M', '3M', '1Y'] as const;
  let range: (typeof RANGES)[number] = '3M';
  let mode: 'candle' | 'line' = 'candle';
  let data: Candle[] = initial;
  let loading = false;
  let loadError = false;
  let container: HTMLDivElement;
  let chart: import('echarts').ECharts | null = null;

  async function loadRange(r: typeof range) {
    range = r; loading = true; loadError = false;
    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/candles?range=${r}`);
      // On a failed fetch keep the previously rendered candles rather than wiping
      // the chart to empty; surface the error to the user instead.
      if (!res.ok) { loadError = true; return; }
      data = (await res.json()).candles ?? [];
    } catch { loadError = true; }
    finally { loading = false; render(); }
  }

  function render() {
    if (!chart) return;
    const ct = getChartTheme();
    const series = mode === 'candle'
      ? [{ type: 'candlestick', data: data.map((k) => [k.o, k.c, k.l, k.h]), itemStyle: { color: '#39d98a', color0: '#f6685e', borderColor: '#39d98a', borderColor0: '#f6685e' } }]
      : [{ type: 'line', data: data.map((k) => k.c), smooth: true, symbol: 'none', lineStyle: { color: ct.color[0], width: 2 } }];
    chart.setOption({ ...ct, grid: { left: 52, right: 16, top: 16, bottom: 28 },
      xAxis: { type: 'category', data: data.map((k) => k.t), axisLabel: { color: ct.axisLabel.color, fontSize: 9 } },
      yAxis: { type: 'value', scale: true, axisLabel: { color: ct.axisLabel.color, fontSize: 9 }, splitLine: ct.splitLine },
      tooltip: { trigger: 'axis' }, series }, true);
  }

  $: if (chart && $theme) render();

  let destroyed = false;
  onMount(() => {
    let ro: ResizeObserver | null = null;
    import('echarts').then((e) => {
      // The component may unmount (e.g. switching to the Options tab) before this
      // async import resolves — bail so we don't init a chart on a detached node
      // or leak a ResizeObserver.
      if (destroyed) return;
      chart = e.init(container, null, { renderer: 'canvas' });
      render();
      ro = new ResizeObserver(() => chart?.resize());
      ro.observe(container);
    });
    return () => ro?.disconnect();
  });
  onDestroy(() => { destroyed = true; chart?.dispose(); });
</script>

<div class="pc">
  <div class="pc-head">
    <div class="pills">
      {#each RANGES as r}<button class:active={range === r} on:click={() => loadRange(r)} disabled={loading}>{r}</button>{/each}
    </div>
    <div class="pills">
      <button class:active={mode === 'candle'} on:click={() => { mode = 'candle'; render(); }}>Candle</button>
      <button class:active={mode === 'line'} on:click={() => { mode = 'line'; render(); }}>Line</button>
    </div>
  </div>
  {#if loadError}<div class="pc-err" role="status">Couldn't load {range} data — showing last values.</div>{/if}
  <div bind:this={container} class="pc-canvas" role="img" aria-label="{symbol} price chart, {range}"></div>
</div>

<style>
  .pc { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:14px; }
  .pc-head { display:flex; justify-content:space-between; margin-bottom:10px; }
  .pills { display:flex; gap:3px; }
  .pills button { font-size:.65rem; font-weight:600; padding:3px 9px; border-radius:6px; border:1px solid transparent; background:none; color:var(--muted); cursor:pointer; }
  .pills button.active { color:var(--primary); background:rgba(var(--primary-rgb),.14); border-color:rgba(var(--primary-rgb),.3); }
  .pc-err { font-size:.68rem; color:#f5b450; margin-bottom:6px; }
  .pc-canvas { height:300px; }
  @media (max-width:767px){ .pc-canvas{ height:240px; } }
</style>
