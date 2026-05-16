function v(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function getChartTheme() {
  const border  = v('--border',      '#1a2038');
  const muted   = v('--muted',       '#7a8fb0');
  const primary = v('--primary',     '#6c8fff');
  const success = v('--success',     '#2dd4a0');
  const danger  = v('--danger',      '#f96b7e');
  const warning = v('--warning',     '#fbbf24');

  return {
    backgroundColor: 'transparent',
    textStyle: { color: muted, fontFamily: 'Inter, system-ui', fontSize: 11 },
    axisLine:  { lineStyle: { color: border } },
    axisTick:  { lineStyle: { color: border } },
    axisLabel: { color: muted, fontSize: 11 },
    splitLine: { lineStyle: { color: border, opacity: 0.4, type: 'dashed' } },
    legend:    { textStyle: { color: muted } },
    color:     [primary, success, danger, warning, '#a78bfa', '#38bdf8'],
  };
}

export type ChartPeriod = '1M' | '3M' | '6M' | '1Y' | 'All';
