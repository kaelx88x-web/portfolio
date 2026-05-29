<script lang="ts">
  import { mockSparkline } from '$lib/data/stock-metadata';

  export let symbol: string;
  export let trend: 'up' | 'down' | 'flat' = 'flat';

  const W = 64;
  const H = 28;

  $: points = mockSparkline(symbol, trend);
  $: {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const xs = points.map((_, i) => (i / (points.length - 1)) * W);
    const ys = points.map(p => H - ((p - min) / range) * H);
    polylinePoints = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  }

  let polylinePoints = '';
  $: color = trend === 'up' ? 'var(--success)' : trend === 'down' ? 'var(--danger)' : 'var(--muted)';
</script>

<svg width={W} height={H} viewBox="0 0 {W} {H}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <polyline points={polylinePoints} stroke={color} stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
</svg>
