import { json, error } from '@sveltejs/kit';
import { getOptionCandidates } from '$lib/services/broker.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const symbols = url.searchParams.get('symbols');
  if (!symbols) throw error(400, 'symbols is required');
  const mode = (url.searchParams.get('mode') ?? 'both') as 'cc' | 'csp' | 'both';
  const symbolList = symbols.split(',').map((s) => s.trim()).filter(Boolean);
  try {
    const result = await getOptionCandidates(symbolList, mode);
    return json(result);
  } catch (e) {
    throw error(502, e instanceof Error ? e.message : 'Failed to fetch option candidates');
  }
};
