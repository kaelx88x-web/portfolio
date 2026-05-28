import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const BRIDGE = process.env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';

interface BridgeAccount {
  acc_id: string;
  trd_env: string;
  acc_status: string;
  trdmarket_auth: string[];
}

export function mapBridgeAccount(a: BridgeAccount) {
  return {
    acc_id: a.acc_id,
    trd_env: a.trd_env as 'REAL' | 'SIMULATE',
    is_real: a.trd_env === 'REAL',
    is_active: a.acc_status === 'ACTIVE',
    markets: a.trdmarket_auth ?? [],
    name: a.trd_env === 'REAL' ? `Live Account (${a.acc_id})` : `Simulate Account (${a.acc_id})`,
  };
}

export const GET: RequestHandler = async ({ locals, setHeaders }) => {
  if (!locals.user) throw error(401, 'Unauthorized');

  try {
    const res = await fetch(`${BRIDGE}/accounts`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`Bridge error ${res.status}`);
    const data = await res.json() as { accounts: BridgeAccount[] };
    const accounts = (data.accounts ?? []).map(mapBridgeAccount);
    setHeaders({ 'cache-control': 'max-age=60' });
    return json(accounts);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Bridge offline' }, { status: 503 });
  }
};
