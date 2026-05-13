<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { CHART_THEME } from '$lib/echarts.config';

  export let allocations: { label: string; percentage: number }[] = [];

  let container: HTMLDivElement;
  let chart: import('echarts').ECharts | null = null;

  $: if (chart) updateChart(allocations);

  function buildOption(data: typeof allocations) {
    return {
      ...CHART_THEME,
      series: [{
        type: 'pie',
        radius: ['48%', '72%'],
        center: ['50%', '50%'],
        data: data.map(a => ({ name: a.label, value: a.percentage })),
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(108,143,255,0.3)' },
        },
      }],
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: { color: '#7a8fb0', fontSize: 11 },
        formatter: (name: string) => {
          const item = data.find(d => d.label === name);
          return `${name}  ${item?.percentage.toFixed(1)}%`;
        },
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f1523',
        borderColor: '#1a2038',
        textStyle: { color: '#dce8ff', fontSize: 12 },
        formatter: '{b}: {c}%',
      },
    };
  }

  function updateChart(data: typeof allocations) {
    chart?.setOption(buildOption(data));
  }

  onMount(async () => {
    const echarts = await import('echarts');
    chart = echarts.init(container, null, { renderer: 'canvas' });
    updateChart(allocations);
    const ro = new ResizeObserver(() => chart?.resize());
    ro.observe(container);
    return () => ro.disconnect();
  });

  onDestroy(() => chart?.dispose());
</script>

<div class="alloc-wrap">
  <div class="alloc-title">Allocation</div>
  <div bind:this={container} class="alloc-canvas"></div>
</div>

<style>
  .alloc-wrap  { background: #0f1523; border-radius: 10px; border: 1px solid #1a2038; padding: 16px; }
  .alloc-title { font-size: 0.8rem; font-weight: 600; color: #dce8ff; margin-bottom: 12px; }
  .alloc-canvas{ height: 220px; }
</style>
