export interface SparklineData {
  /** Normalized 0–1 values for SVG rendering, length ≤ 5 */
  points: number[];
  /** Actual closing prices for tooltip display */
  prices: number[];
  /** Short date labels, e.g. "Mon 26", length matches points */
  dates: string[];
  trend: 'up' | 'down' | 'flat';
}

export interface PriceData {
  /** Current / last-close price */
  price: number;
  /** % change from previous close — 2.1 means +2.1% */
  changePercent: number;
  sparkline: SparklineData | null;
}
