<!-- src/lib/components/stocks/MiniSparkline.svelte -->
<script lang="ts">
  import type { SparklineData } from '$lib/types/prices';
  import { mockSparkline } from '$lib/data/stock-metadata';

  export let symbol: string;
  export let trend: 'up' | 'down' | 'flat' = 'flat';
  export let sparkline: SparklineData | undefined = undefined;
  /** Currency code for tooltip formatting: 'USD' | 'MYR' | 'HKD' */
  export let currency: string = 'USD';

  const W = 64;
  const H = 28;

  const CURRENCY_PREFIX: Record<string, string> = {
    USD: '$',
    MYR: 'RM ',
    HKD: 'HK$',
  };

  function normalizeRaw(values: number[]): number[] {
    if (values.length === 0) return [];
    if (values.length === 1) return [0.5];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    if (range === 0) return values.map(() => 0.5);
    return values.map(v => (v - min) / range);
  }

  // Use real sparkline points if provided, otherwise fall back to mock
  $: rawPoints = sparkline ? sparkline.points : normalizeRaw(mockSparkline(symbol, trend));
  $: activeTrend = sparkline ? sparkline.trend : trend;

  $: color =
    activeTrend === 'up'
      ? 'var(--success)'
      : activeTrend === 'down'
      ? 'var(--danger)'
      : 'var(--muted)';

  // Unique gradient ID per symbol (safe for SVG defs)
  $: gradId = `spk-${symbol.replace(/[^a-zA-Z0-9]/g, '')}`;

  // Map normalized 0–1 points to SVG coordinates
  $: pts = rawPoints.map((p, i) => ({
    x: rawPoints.length === 1 ? W / 2 : (i / (rawPoints.length - 1)) * W,
    y: H - p * (H - 2) - 1, // 1px padding top/bottom
  }));

  $: polylineStr = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  // Close the fill polygon at bottom-right and bottom-left (guard against empty pts)
  $: polygonStr =
    pts.length < 1
      ? ''
      : polylineStr + ` ${pts[pts.length - 1].x.toFixed(1)},${H} 0,${H}`;

  // Hover state
  let hoveredIdx: number | null = null;

  function handleMouseMove(e: MouseEvent) {
    if (!sparkline || pts.length === 0) return;
    const svg = e.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const step = pts.length === 1 ? rect.width : rect.width / (pts.length - 1);
    hoveredIdx = Math.max(0, Math.min(pts.length - 1, Math.round(x / step)));
  }

  function handleMouseLeave() {
    hoveredIdx = null;
  }

  function fmtPrice(val: number): string {
    const prefix = CURRENCY_PREFIX[currency] ?? '$';
    return `${prefix}${val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
</script>

<div class="spark-wrap">
  {#if hoveredIdx !== null && sparkline}
    <div class="spark-tooltip">
      <span class="spark-date">{sparkline.dates[hoveredIdx]}</span>
      <span class="spark-price">{fmtPrice(sparkline.prices[hoveredIdx])}</span>
    </div>
  {/if}

  <svg
    width={W}
    height={H}
    viewBox="0 0 {W} {H}"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    on:mousemove={handleMouseMove}
    on:mouseleave={handleMouseLeave}
    style="cursor:{sparkline ? 'crosshair' : 'default'}"
  >
    <defs>
      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color={color} stop-opacity="0.25" />
        <stop offset="100%" stop-color={color} stop-opacity="0" />
      </linearGradient>
    </defs>

    <!-- Gradient fill area -->
    <polygon points={polygonStr} fill="url(#{gradId})" />

    <!-- Price line -->
    <polyline
      points={polylineStr}
      stroke={color}
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
    />

    <!-- Hover dot -->
    {#if hoveredIdx !== null && pts[hoveredIdx]}
      <circle
        cx={pts[hoveredIdx].x}
        cy={pts[hoveredIdx].y}
        r="2.5"
        fill={color}
      />
    {/if}
  </svg>
</div>

<style>
  .spark-wrap {
    position: relative;
    display: inline-block;
    line-height: 0;
  }
  .spark-tooltip {
    position: absolute;
    bottom: calc(100% + 4px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 3px 7px;
    font-size: 0.62rem;
    white-space: nowrap;
    pointer-events: none;
    z-index: 10;
    display: flex;
    gap: 5px;
    align-items: center;
  }
  .spark-date { color: var(--muted); }
  .spark-price { color: var(--text); font-weight: 600; }
</style>
