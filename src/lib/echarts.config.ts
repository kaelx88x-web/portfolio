export const CHART_THEME = {
  backgroundColor: 'transparent',
  textStyle: { color: '#7a8fb0', fontFamily: 'Inter, system-ui', fontSize: 11 },
  axisLine:  { lineStyle: { color: '#1a2038' } },
  axisTick:  { lineStyle: { color: '#1a2038' } },
  axisLabel: { color: '#7a8fb0', fontSize: 11 },
  splitLine: { lineStyle: { color: '#1a203830', type: 'dashed' } },
  legend:    { textStyle: { color: '#7a8fb0' } },
  color:     ['#6c8fff', '#2dd4a0', '#f96b7e', '#fbbf24', '#a78bfa', '#38bdf8'],
} as const;

export type ChartPeriod = '1M' | '3M' | '6M' | '1Y' | 'All';
