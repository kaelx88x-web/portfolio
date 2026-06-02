import { json } from '@sveltejs/kit';
import { getOptionCandidates, getOptionSpreadCandidates } from '$lib/services/broker.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, locals }) => {
  void locals.user!;
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  const mode = url.searchParams.get('mode') ?? 'both'; // cc | csp | both | spread
  try {
    if (mode === 'spread') {
      const expiry = url.searchParams.get('expiry') ?? '';
      const strategy = url.searchParams.get('strategy') ?? 'bull_put';
      const width = parseFloat(url.searchParams.get('width') ?? '0.5') || 0.5;
      return json({ status: 'ready', mode, candidates: await getOptionSpreadCandidates(symbol, expiry, strategy, width) });
    }
    const r = await getOptionCandidates([symbol], mode as 'cc' | 'csp' | 'both');
    return json({ status: 'ready', mode, candidates: r.candidates });
  } catch {
    return json({ status: 'unavailable', candidates: [] });
  }
};
