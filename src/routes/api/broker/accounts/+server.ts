import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mapBridgeAccount, mapDbAccount, type BridgeAccount } from './accounts.utils.js';
import { prisma } from '$lib/server/db';

const BRIDGE = process.env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';

export const GET: RequestHandler = async ({ locals, setHeaders }) => {
  if (!locals.user) throw error(401, 'Unauthorized');

  // Preferred: the live bridge list (authoritative; includes accounts that may
  // not be in the DB yet). Short timeout so a hung bridge doesn't stall the UI.
  try {
    const res = await fetch(`${BRIDGE}/accounts`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Bridge error ${res.status}`);
    const data = (await res.json()) as { accounts: BridgeAccount[] };
    const accounts = (data.accounts ?? []).map(mapBridgeAccount);
    if (accounts.length > 0) {
      setHeaders({ 'cache-control': 'max-age=60' });
      return json(accounts);
    }
    // Bridge reachable but returned no accounts — fall through to the DB list.
  } catch (e) {
    console.error(
      '[/api/broker/accounts] bridge unavailable, using DB fallback:',
      e instanceof Error ? e.message : String(e)
    );
  }

  // Fallback: accounts already known in the DB. Switching only sets the active
  // account (a DB write), so this keeps the topbar switcher working even when
  // OpenD / the bridge is offline.
  const dbAccounts = await prisma.account
    .findMany({
      where: { userId: locals.user.id, brokerAccId: { not: null } },
      orderBy: [{ accountType: 'asc' }, { name: 'asc' }],
      select: { brokerAccId: true, name: true, accountType: true }
    })
    .catch(() => []);

  return json(dbAccounts.map(mapDbAccount));
};
