<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { ChartPeriod } from '$lib/echarts.config';
  import { getChartTheme } from '$lib/echarts.config';
  import { theme } from '$lib/stores/ui';

  export let snapshots: { date: string; totalValue: number }[] = [];
  export let period: ChartPeriod = '1Y';

  let container: HTMLDivElement;
  let chart: import('echarts').ECharts | null = null;

  const periods: ChartPeriod[] = ['1M', '3M', '6M', '1Y', 'All'];

  $: filtered = filterByPeriod(snapshots, period);
  $: if (chart) updateChart(filtered);
  $: if (chart && $theme) updateChart(filtered);

  function filterByPeriod(data: typeof snapshots, p: ChartPeriod) {
    if (p === 'All' || !data.length) return data;
    const days = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }[p];
    const cutoff = new Date(Date.now() - days * 86400000);
    return data.filter(s => new Date(s.date) >= cutoff);
  }

  function buildOption(data: typeof snapshots) {
    const ct = getChartTheme();
    const primary = ct.color[0];
    const pRgb = getComputedStyle(document.documentElement).getPropertyValue('--primary-rgb').trim() || '108,143,255';
    return {
      ...ct,
      grid: { left: 60, right: 20, top: 20, bottom: 40 },
      xAxis: {
        type: 'category',
        data: data.map(s => new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        axisLine:  { lineStyle: { color: ct.axisLine.lineStyle.color } },
        axisTick:  { show: false },
        axisLabel: { color: ct.axisLabel.color, fontSize: 10 },
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: ct.axisLabel.color, fontSize: 10,
          formatter: (v: number) => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v),
        },
        splitLine: ct.splitLine,
      },
      series: [{
        type: 'line',
        data: data.map(s => s.totalValue),
        smooth: true,
        lineStyle: { color: primary, width: 2 },
        itemStyle: { color: primary },
        symbol: 'none',
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `rgba(${pRgb},0.25)` },
              { offset: 1, color: `rgba(${pRgb},0.02)` },
            ],
          },
        },
      }],
      tooltip: {
        trigger: 'axis',
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#0f1523',
        borderColor: ct.axisLine.lineStyle.color,
        textStyle: { color: getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#dce8ff', fontSize: 12 },
        formatter: (params: { name: string; value: number }[]) => {
          if (!params[0]) return '';
          return `${params[0].name}<br/><b>$${params[0].value.toLocaleString()}</b>`;
        },
      },
    };
  }

  function updateChart(data: typeof snapshots) {
    chart?.setOption(buildOption(data));
  }

  onMount(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;

    import('echarts').then((echarts) => {
      if (disposed) return;
      chart = echarts.init(container, null, { renderer: 'canvas' });
      updateChart(filtered);
      ro = new ResizeObserver(() => chart?.resize());
      ro.observe(container);
    });

    return () => {
      disposed = true;
      ro?.disconnect();
    };
  });

  onDestroy(() => chart?.dispose());
</script>

<div class="chart-wrap">
  <div class="chart-header">
    <span class="chart-title">Portfolio Growth</span>
    <div class="period-tabs">
      {#each periods as p}
        <button
          class="period-btn"
          class:active={period === p}
          on:click={() => period = p}
        >{p}</button>
      {/each}
    </div>
  </div>
  <div bind:this={container} class="chart-canvas"></div>
</div>

<style>
  .chart-wrap   { background: var(--card); border-radius: 10px; border: 1px solid var(--border); padding: 16px; }
  .chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .chart-title  { font-size: 0.8rem; font-weight: 600; color: var(--text); }
  .period-tabs  { display: flex; gap: 2px; }
  .period-btn   { padding: 3px 8px; border-radius: 5px; font-size: 0.65rem; font-weight: 600; border: 1px solid transparent; background: none; color: var(--muted); cursor: pointer; transition: all 0.15s; }
  .period-btn:hover  { color: var(--text); background: rgba(var(--primary-rgb),0.08); }
  .period-btn.active { color: var(--primary); background: rgba(var(--primary-rgb),0.14); border-color: rgba(var(--primary-rgb),0.3); }
  .chart-canvas { height: 220px; }
</style>
