<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { ChartPeriod } from '$lib/echarts.config';
  import { CHART_THEME } from '$lib/echarts.config';

  export let snapshots: { date: string; totalValue: number }[] = [];
  export let period: ChartPeriod = '1Y';

  let container: HTMLDivElement;
  let chart: import('echarts').ECharts | null = null;

  const periods: ChartPeriod[] = ['1M', '3M', '6M', '1Y', 'All'];

  $: filtered = filterByPeriod(snapshots, period);
  $: if (chart) updateChart(filtered);

  function filterByPeriod(data: typeof snapshots, p: ChartPeriod) {
    if (p === 'All' || !data.length) return data;
    const days = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }[p];
    const cutoff = new Date(Date.now() - days * 86400000);
    return data.filter(s => new Date(s.date) >= cutoff);
  }

  function buildOption(data: typeof snapshots) {
    return {
      ...CHART_THEME,
      grid: { left: 60, right: 20, top: 20, bottom: 40 },
      xAxis: {
        type: 'category',
        data: data.map(s => new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        axisLine:  { lineStyle: { color: '#1a2038' } },
        axisTick:  { show: false },
        axisLabel: { color: '#7a8fb0', fontSize: 10 },
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#7a8fb0', fontSize: 10,
          formatter: (v: number) => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v),
        },
        splitLine: { lineStyle: { color: '#1a203820', type: 'dashed' } },
      },
      series: [{
        type: 'line',
        data: data.map(s => s.totalValue),
        smooth: true,
        lineStyle: { color: '#6c8fff', width: 2 },
        itemStyle: { color: '#6c8fff' },
        symbol: 'none',
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(108,143,255,0.25)' },
              { offset: 1, color: 'rgba(108,143,255,0.02)' },
            ],
          },
        },
      }],
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f1523',
        borderColor: '#1a2038',
        textStyle: { color: '#dce8ff', fontSize: 12 },
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

  onMount(async () => {
    const echarts = await import('echarts');
    chart = echarts.init(container, null, { renderer: 'canvas' });
    updateChart(filtered);
    const ro = new ResizeObserver(() => chart?.resize());
    ro.observe(container);
    return () => ro.disconnect();
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
  .chart-wrap   { background: #0f1523; border-radius: 10px; border: 1px solid #1a2038; padding: 16px; }
  .chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .chart-title  { font-size: 0.8rem; font-weight: 600; color: #dce8ff; }
  .period-tabs  { display: flex; gap: 2px; }
  .period-btn   { padding: 3px 8px; border-radius: 5px; font-size: 0.65rem; font-weight: 600; border: 1px solid transparent; background: none; color: #7a8fb0; cursor: pointer; transition: all 0.15s; }
  .period-btn:hover  { color: #dce8ff; background: rgba(108,143,255,0.08); }
  .period-btn.active { color: #6c8fff; background: rgba(108,143,255,0.14); border-color: rgba(108,143,255,0.3); }
  .chart-canvas { height: 220px; }
</style>
