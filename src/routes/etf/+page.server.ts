import type { PageServerLoad } from './$types';
import { getQuoteSnapshots, getCapitalFlow } from '$lib/services/broker.service';

const POPULAR_ETFS = [
  // US Broad Market
  'US.SPY', 'US.QQQ', 'US.VTI', 'US.VOO', 'US.IWM', 'US.DIA',
  // Sector
  'US.XLK', 'US.XLF', 'US.XLE', 'US.XLV', 'US.XLY', 'US.XLI',
  // International
  'US.EFA', 'US.EEM', 'US.VEA', 'US.VWO',
  // Bond
  'US.AGG', 'US.BND', 'US.TLT', 'US.HYG',
  // Commodity / Thematic
  'US.GLD', 'US.SLV', 'US.ARKK', 'US.SCHD',
];

export const load: PageServerLoad = async () => {
  try {
    const [snapshots, flows] = await Promise.allSettled([
      getQuoteSnapshots(POPULAR_ETFS),
      getCapitalFlow(POPULAR_ETFS),
    ]);

    const snapshotMap = new Map(
      (snapshots.status === 'fulfilled' ? snapshots.value : []).map((s) => [s.code, s])
    );
    const flowMap = new Map(
      (flows.status === 'fulfilled' ? flows.value : []).map((f) => [f.code, f])
    );

    const etfs = POPULAR_ETFS.map((code) => {
      const s = snapshotMap.get(code) as any;
      const f = flowMap.get(code);
      const ticker = code.split('.').pop() ?? code;
      const last = s?.last_price ?? null;
      const prev = s?.prev_close_price ?? null;
      const change = last !== null && prev !== null ? +(last - prev).toFixed(4) : null;
      const change_pct = change !== null && prev ? +((change / prev) * 100).toFixed(2) : null;
      return {
        code,
        ticker,
        name: s?.name ?? ticker,
        last_price: last,
        change,
        change_pct,
        volume: s?.volume ?? null,
        turnover: s?.turnover ?? null,
        market_cap: s?.total_market_val ?? null,
        in_flow: f?.in_flow ?? null,
        main_in_flow: f?.main_in_flow ?? null,
      };
    });

    return { etfs, error: null };
  } catch (e) {
    return { etfs: [], error: e instanceof Error ? e.message : 'Failed to load ETF data.' };
  }
};
