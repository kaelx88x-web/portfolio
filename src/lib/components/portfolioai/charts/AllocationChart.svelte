<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getChartTheme } from '$lib/echarts.config';
  import { theme } from '$lib/stores/ui';

  export let allocations: { label: string; percentage: number }[] = [];
  export let holdingAllocations: { label: string; percentage: number }[] = [];

  let container: HTMLDivElement;
  let chart: import('echarts').ECharts | null = null;
  let tab: 'sector' | 'stock' = 'stock';

  $: activeData = tab === 'sector' ? allocations : holdingAllocations;
  $: if (chart) updateChart(activeData);
  $: if (chart && $theme) updateChart(activeData);

  const COLORS = [
    '#6c8fff','#2dd4a0','#f96b7e','#fbbf24','#a78bfa',
    '#34d399','#fb923c','#60a5fa','#f472b6','#4ade80',
  ];

  function buildOption(data: typeof allocations) {
    const ct = getChartTheme();
    const cs = getComputedStyle(document.documentElement);
    return {
      ...ct,
      color: COLORS,
      series: [{
        type: 'pie',
        radius: ['44%', '68%'],
        center: ['40%', '50%'],
        data: data.map(a => ({ name: a.label, value: +a.percentage.toFixed(2) })),
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: `rgba(${cs.getPropertyValue('--primary-rgb').trim() || '108,143,255'},0.3)` },
        },
      }],
      legend: {
        orient: 'vertical',
        right: 0,
        top: 'center',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: ct.legend.textStyle.color, fontSize: 11 },
        formatter: (name: string) => {
          const item = data.find(d => d.label === name);
          return `${name}  ${item?.percentage.toFixed(1)}%`;
        },
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: cs.getPropertyValue('--card').trim() || '#0f1523',
        borderColor: ct.axisLine.lineStyle.color,
        textStyle: { color: cs.getPropertyValue('--text').trim() || '#dce8ff', fontSize: 12 },
        formatter: '{b}: {c}%',
      },
    };
  }

  function updateChart(data: typeof allocations) {
    chart?.setOption(buildOption(data), true);
  }

  onMount(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;

    import('echarts').then((echarts) => {
      if (disposed) return;
      chart = echarts.init(container, null, { renderer: 'canvas' });
      updateChart(activeData);
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

<div class="alloc-wrap">
  <div class="alloc-header">
    <div class="alloc-title">Allocation</div>
    <div class="tabs">
      <button class="tab" class:active={tab === 'stock'} on:click={() => tab = 'stock'}>Stock</button>
      <button class="tab" class:active={tab === 'sector'} on:click={() => tab = 'sector'}>Sector</button>
    </div>
  </div>
  <div bind:this={container} class="alloc-canvas"></div>
</div>

<style>
  .alloc-wrap   { background: var(--card); border-radius: 10px; border: 1px solid var(--border); padding: 16px; }
  .alloc-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .alloc-title  { font-size: 0.8rem; font-weight: 600; color: var(--text); }

  .tabs { display: flex; gap: 2px; background: var(--surface-1); border-radius: 6px; padding: 2px; }
  .tab {
    padding: 3px 10px; border-radius: 4px; font-size: 0.68rem; font-weight: 600;
    color: var(--muted); background: none; border: none; cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .tab.active { background: rgba(var(--primary-rgb),0.15); color: var(--primary); }
  .tab:hover:not(.active) { color: var(--text); }

  .alloc-canvas { height: 220px; }
</style>
