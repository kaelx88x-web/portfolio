<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getChartTheme } from '$lib/echarts.config';
  import { theme } from '$lib/stores/ui';

  export let nodes: { ticker: string; name: string; sector: string | null; market: string | null }[] = [];
  export let edges: {
    source: string; target: string; type: string; weight: number;
    confidence: number | null; groundedSource: string | null;
  }[] = [];

  let container: HTMLDivElement;
  let chart: import('echarts').ECharts | null = null;

  // Semantic edges colored by type; structural edges muted. Width ∝ weight.
  const EDGE_COLOR: Record<string, string> = {
    competitor: '#f96b7e',
    supplier: '#2dd4a0',
    customer: '#fbbf24',
    same_sector: '#4b5563',
    same_concept: '#6b7280',
    co_owned_by: '#a78bfa',
  };
  const STRUCTURAL = new Set(['same_sector', 'same_concept', 'co_owned_by']);

  $: if (chart) updateChart(nodes, edges);
  $: if (chart && $theme) updateChart(nodes, edges);

  function buildOption(
    ns: typeof nodes,
    es: typeof edges
  ) {
    const ct = getChartTheme();
    return {
      ...ct,
      tooltip: {
        formatter: (p: { dataType: string; data: Record<string, unknown> }) => {
          if (p.dataType === 'edge') {
            const d = p.data;
            const conf = d.confidence == null ? 'fact' : `confidence ${(Number(d.confidence) * 100).toFixed(0)}%`;
            return `${d.source} → ${d.target}<br/>${d.relType} (${conf})<br/><small>${d.grounded ?? ''}</small>`;
          }
          return `${p.data.name}`;
        },
      },
      series: [{
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        focusNodeAdjacency: true,
        force: { repulsion: 220, edgeLength: 120, gravity: 0.08 },
        label: { show: true, position: 'right', color: ct.legend.textStyle.color, fontSize: 11 },
        emphasis: { focus: 'adjacency', lineStyle: { width: 4 } },
        data: ns.map((n) => ({ name: n.ticker, value: n.name, symbolSize: 34,
          itemStyle: { color: '#6c8fff' } })),
        links: es.map((e) => ({
          source: e.source,
          target: e.target,
          relType: e.type,
          confidence: e.confidence,
          grounded: e.groundedSource,
          lineStyle: {
            color: EDGE_COLOR[e.type] ?? '#3a4458',
            width: Math.min(1 + e.weight, 6),
            type: STRUCTURAL.has(e.type) ? 'dashed' : 'solid',
            opacity: STRUCTURAL.has(e.type) ? 0.45 : 0.9,
          },
        })),
      }],
    };
  }

  function updateChart(ns: typeof nodes, es: typeof edges) {
    chart?.setOption(buildOption(ns, es), true);
  }

  onMount(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;
    import('echarts').then((echarts) => {
      if (disposed) return;
      chart = echarts.init(container, null, { renderer: 'canvas' });
      updateChart(nodes, edges);
      ro = new ResizeObserver(() => chart?.resize());
      ro.observe(container);
    });
    return () => { disposed = true; ro?.disconnect(); };
  });

  onDestroy(() => chart?.dispose());
</script>

<div bind:this={container} class="kg-canvas"></div>
<ul class="kg-legend">
  <li><span class="swatch solid" style="border-top-color:#f96b7e"></span>Competitor</li>
  <li><span class="swatch solid" style="border-top-color:#2dd4a0"></span>Supplier</li>
  <li><span class="swatch solid" style="border-top-color:#fbbf24"></span>Customer</li>
  <li><span class="swatch dashed"></span>Structural (sector / concept / co-owned)</li>
</ul>

<style>
  .kg-canvas { width: 100%; height: 560px; }
  .kg-legend {
    display: flex; flex-wrap: wrap; gap: 14px; list-style: none;
    margin: 8px 0 0; padding: 0; font-size: 0.72rem; color: var(--muted);
  }
  .kg-legend li { display: flex; align-items: center; gap: 6px; }
  .swatch { width: 14px; height: 0; border-top-width: 3px; border-top-style: solid; display: inline-block; }
  .swatch.solid { }
  .swatch.dashed { border-top-style: dashed; border-top-color: var(--muted); }
</style>
